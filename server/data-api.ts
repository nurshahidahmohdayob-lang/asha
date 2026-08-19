/* ═══════════ Database API — the only thing that touches Supabase ═════════
   The browser never gets a database key. It sends its Firebase ID token, this
   verifies the token, works out who is asking, and only then talks to
   Supabase with the service_role key, which never leaves the server.

   That makes access control STRONGER than the Firestore rules it replaces:
   there, a teacher's own query decided what to fetch and the rules only
   vetoed it. Here the server decides, and a caller cannot ask for another
   teacher's rows at all.

   Auth deliberately stays on Firebase — teachers keep their accounts and
   their passwords. This file is the bridge between the two. */

import type { Express, Request, Response } from "express";
import { createDriver, type DbDriver } from "./db-driver";
import jwt from "jsonwebtoken";

/* ── Verifying a Firebase ID token without firebase-admin ────────────────
   Google publishes the public certificates that sign these tokens, so the
   signature can be checked directly. Nothing secret is needed, which means
   no service-account file to store or leak. */

const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { keys: Record<string, string>; expiresAt: number } = {
  keys: {},
  expiresAt: 0,
};

async function googleCerts(): Promise<Record<string, string>> {
  if (Date.now() < certCache.expiresAt && Object.keys(certCache.keys).length) {
    return certCache.keys;
  }
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error(`Could not fetch Google certs (${res.status})`);
  const keys = (await res.json()) as Record<string, string>;
  // Respect the cache header — these rotate roughly daily.
  const cc = res.headers.get("cache-control") || "";
  const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] || 3600);
  certCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

export type Caller = { uid: string; email: string };

async function verifyIdToken(
  token: string,
  projectId: string,
): Promise<Caller> {
  const decoded: any = jwt.decode(token, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) throw new Error("Malformed token");

  const certs = await googleCerts();
  const cert = certs[kid];
  if (!cert) throw new Error("Unknown signing key");

  const payload: any = jwt.verify(token, cert, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });
  if (!payload?.sub) throw new Error("Token has no subject");
  return { uid: String(payload.sub), email: String(payload.email || "") };
}

/* ── What each table allows ──────────────────────────────────────────────
   Mirrors the Firestore rules this replaces. `owner` names the column that
   must equal the caller's uid; a null owner means the table is shared. */

type TableRule = {
  owner: string | null;
  /** Reviewers (admin / HOD / coordinator) may read every row. */
  reviewersReadAll?: boolean;
  /** Only reviewers may write. */
  reviewersWriteOnly?: boolean;
};

const TABLES: Record<string, TableRule> = {
  projects: { owner: "user_id" },
  folders: { owner: "user_id" },
  professional_development: { owner: "user_id" },
  submitted_plans: { owner: "user_id", reviewersReadAll: true },
  submitted_folders: { owner: null },
  users: { owner: null },
  school_config: { owner: null, reviewersWriteOnly: true },
};

const REVIEWER_ROLES = ["admin", "hod", "coordinator"];

export function mountDataApi(app: Express, projectId: string) {
  // Absent config is not an error — the app runs on Firestore until the
  // switch is flipped, and these routes simply say so if called. Which
  // database answers is decided in db-driver.ts; everything below is about
  // WHO may touch WHAT, which is the same either way.
  const { driver, why } = createDriver();
  console.log(
    driver
      ? `[data-api] backend ready: ${why}.`
      : "[data-api] no database configured — data API disabled, app stays on Firestore.",
  );

  /** Verify the caller and look up their roles. */
  async function authenticate(req: Request): Promise<Caller & { roles: string[] }> {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw Object.assign(new Error("Not signed in"), { status: 401 });

    const caller = await verifyIdToken(token, projectId).catch((e) => {
      throw Object.assign(new Error(`Invalid session: ${e.message}`), {
        status: 401,
      });
    });

    // Roles come from the database, never from the request — a caller cannot
    // promote themselves by claiming to be an admin.
    let roles: string[] = ["educator"];
    if (driver) {
      const row = await driver.get("users", "uid", caller.uid);
      // MySQL hands back a JSON column parsed; a string would mean an older
      // server or a hand-written row, so parse defensively rather than trust.
      let stored = row?.roles;
      if (typeof stored === "string") {
        try { stored = JSON.parse(stored); } catch { stored = null; }
      }
      if (Array.isArray(stored) && stored.length) roles = stored;
    }
    return { ...caller, roles };
  }

  const isReviewer = (roles: string[]) =>
    roles.some((r) => REVIEWER_ROLES.includes(r));

  /** Which column carries the record's id. */
  const idColumnFor = (table: string): string =>
    table === "users"
      ? "uid"
      : table === "professional_development"
        ? "user_id"
        : "id";

  function ruleFor(table: string): TableRule {
    const rule = TABLES[table];
    if (!rule)
      throw Object.assign(new Error(`Unknown table "${table}"`), { status: 400 });
    return rule;
  }

  const send = (res: Response, err: any) =>
    res.status(err?.status || 500).json({ error: err?.message || String(err) });

  const guardReady = (res: Response) => {
    if (!driver) {
      res.status(503).json({ error: "Supabase backend is not configured." });
      return false;
    }
    return true;
  };

  /* ── Read many ──────────────────────────────────────────────────────── */
  app.post("/api/data/list", async (req, res) => {
    if (!guardReady(res)) return;
    try {
      const caller = await authenticate(req);
      const { table, where = [], orderBy, select, ids } = req.body || {};
      const rule = ruleFor(table);

      // "stamps" returns id and updated_at only. A watcher polls that to see
      // what moved — tens of bytes a row instead of kilobytes — then asks for
      // the full rows of just those ids. Ownership is applied either way, so
      // neither mode widens what a caller can see.
      const idCol = idColumnFor(table);

      // Ownership is applied by the SERVER, not taken from the request, so a
      // caller cannot widen their own reach by editing the query they send.
      const mayReadAll =
        !rule.owner || (rule.reviewersReadAll && isReviewer(caller.roles));
      const filters: [string, unknown][] = [];
      if (!mayReadAll) filters.push([rule.owner!, caller.uid]);

      for (const [field, , value] of where as [string, string, any][]) {
        // A filter on the owner column is redundant once the server has
        // pinned it, and must not be able to point at someone else.
        if (rule.owner && field === rule.owner && !mayReadAll) continue;
        filters.push([field, value]);
      }

      // Nothing to fetch is a valid answer, and must not be read as "no
      // filter" — that would return the whole table.
      if (Array.isArray(ids) && !ids.length) return res.json({ rows: [], stamps: true });

      // Stamps need the marker column. Without it the honest answer is full
      // rows plus a flag, so the watcher stops trying to diff and reads
      // everything — slower, but it works rather than failing.
      const wantsStamps = select === "stamps";
      const canStamp = wantsStamps ? await driver!.supportsStamps(table) : false;

      let rows = await driver!.list({
        table,
        idCol,
        filters,
        ids: Array.isArray(ids) ? ids.slice(0, 500).map(String) : undefined,
        stampsOnly: canStamp,
      });
      if (orderBy) {
        const [field, dir] = orderBy as [string, "asc" | "desc"];
        rows = [...rows].sort((a: any, b: any) => {
          const av = a?.[field];
          const bv = b?.[field];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av > bv ? 1 : -1) * (dir === "desc" ? -1 : 1);
        });
      }
      res.json({ rows, stamps: wantsStamps ? canStamp : true });
    } catch (err: any) {
      send(res, err);
    }
  });

  /* ── Read one ───────────────────────────────────────────────────────── */
  app.post("/api/data/get", async (req, res) => {
    if (!guardReady(res)) return;
    try {
      const caller = await authenticate(req);
      const { table, id } = req.body || {};
      const rule = ruleFor(table);
      const idCol = table === "users" ? "uid" : table === "professional_development" ? "user_id" : "id";

      const data = await driver!.get(table, idCol, id);
      if (!data) return res.json({ row: null });

      const mayRead =
        !rule.owner ||
        data[rule.owner] === caller.uid ||
        (rule.reviewersReadAll && isReviewer(caller.roles));
      if (!mayRead)
        throw Object.assign(new Error("Not yours to read"), { status: 403 });

      res.json({ row: data });
    } catch (err: any) {
      send(res, err);
    }
  });

  /* ── Create or overwrite ────────────────────────────────────────────── */
  app.post("/api/data/put", async (req, res) => {
    if (!guardReady(res)) return;
    try {
      const caller = await authenticate(req);
      const { table, id, row } = req.body || {};
      const rule = ruleFor(table);

      if (rule.reviewersWriteOnly && !isReviewer(caller.roles))
        throw Object.assign(new Error("Not allowed"), { status: 403 });

      const idCol = table === "users" ? "uid" : table === "professional_development" ? "user_id" : "id";
      const record: Record<string, any> = { ...row, [idCol]: id };
      // Stamped by the SERVER so a watcher cannot be fooled into skipping a
      // change by a client that forgot, or declined, to move it forward — and
      // only where the column exists, because stamping one that does not fails
      // the entire write and no teacher could save.
      if (await driver!.supportsStamps(table)) record.updated_at = Date.now();
      // The owner is stamped from the verified token, never from the body.
      if (rule.owner) record[rule.owner] = caller.uid;

      await driver!.upsert(table, idCol, record);
      res.json({ ok: true, id });
    } catch (err: any) {
      send(res, err);
    }
  });

  /* ── Patch fields ───────────────────────────────────────────────────── */
  app.post("/api/data/patch", async (req, res) => {
    if (!guardReady(res)) return;
    try {
      const caller = await authenticate(req);
      const { table, id, changes } = req.body || {};
      const rule = ruleFor(table);
      const idCol = table === "users" ? "uid" : table === "professional_development" ? "user_id" : "id";

      // A teacher may only patch their own rows; a reviewer may move a
      // submission through the approval flow.
      const pinOwner =
        rule.owner && !(rule.reviewersReadAll && isReviewer(caller.roles))
          ? ([rule.owner, caller.uid] as [string, unknown])
          : undefined;
      const patched = { ...changes };
      if (await driver!.supportsStamps(table)) patched.updated_at = Date.now();
      await driver!.update(table, idCol, id, patched, pinOwner);
      res.json({ ok: true });
    } catch (err: any) {
      send(res, err);
    }
  });

  /* ── Delete ─────────────────────────────────────────────────────────── */
  app.post("/api/data/remove", async (req, res) => {
    if (!guardReady(res)) return;
    try {
      const caller = await authenticate(req);
      const { table, id } = req.body || {};
      const rule = ruleFor(table);
      const idCol = table === "users" ? "uid" : table === "professional_development" ? "user_id" : "id";

      const pinOwner =
        rule.owner && !isReviewer(caller.roles)
          ? ([rule.owner, caller.uid] as [string, unknown])
          : undefined;
      await driver!.remove(table, idCol, id, pinOwner);
      res.json({ ok: true });
    } catch (err: any) {
      send(res, err);
    }
  });

  /* ── Health, so the switch can be tested before it is flipped ────────── */
  app.get("/api/data/health", async (_req, res) => {
    if (!driver) return res.json({ ready: false, reason: "not configured" });
    try {
      await driver.ping();
      // Surfaced because it is invisible otherwise: reads and writes work
      // without the marker, and only the bandwidth cost of watching changes.
      const stamps = await driver.supportsStamps("submitted_plans");
      res.json({ ready: true, reason: null, backend: driver.kind, stamps });
    } catch (err: any) {
      res.json({ ready: false, reason: err?.message || String(err), backend: driver.kind });
    }
  });
}
