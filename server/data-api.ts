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

/** A verified caller plus the roles read from the database. */
export type Actor = Caller & { roles: string[] };

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
   One entry per table, mirroring firestore.rules verb for verb, because that
   is the thing this replaces and the only way to see at a glance whether it
   still matches. The earlier shape — two loose booleans — could not express
   "a reviewer may move a submission along but only an admin may delete it",
   and quietly granted the wider of the two everywhere it was consulted.

   `owner` names the column that must equal the caller's uid. A grant of
   "owner" means "your own rows"; "reviewer" and "admin" mean every row;
   "signedIn" means every row for anyone with a valid token. A verb whose
   list a caller matches none of is refused outright. */

type Grant = "owner" | "reviewer" | "admin" | "signedIn";

type TableRule = {
  owner: string | null;
  /** get and list. */
  read: Grant[];
  /** put and patch. */
  write: Grant[];
  /** remove. Deliberately separate: a reviewer who may edit a submission is
   *  not thereby allowed to destroy it. */
  delete: Grant[];
  /** Columns only an admin may set. Dropped from anyone else's write rather
   *  than refused, so an ordinary save of the rest of the row still works. */
  adminOnlyFields?: string[];
  /** Columns taken from the verified token, never from the request body.
   *  Maps the caller field to the column that carries it. */
  tokenFields?: { uid?: string; email?: string };
};

const TABLES: Record<string, TableRule> = {
  projects: {
    owner: "user_id",
    read: ["owner", "admin"],
    write: ["owner", "admin"],
    delete: ["owner", "admin"],
  },
  folders: {
    owner: "user_id",
    read: ["owner", "admin"],
    write: ["owner", "admin"],
    delete: ["owner", "admin"],
  },
  // A HOD or coordinator reads these to sign off training hours; only the
  // teacher and an admin may change them.
  professional_development: {
    owner: "user_id",
    read: ["owner", "reviewer", "admin"],
    write: ["owner", "admin"],
    delete: ["owner", "admin"],
  },
  // Reviewers move a submission through the approval flow. Deleting one is
  // the owner's or an admin's call.
  submitted_plans: {
    owner: "user_id",
    read: ["owner", "reviewer", "admin"],
    write: ["owner", "reviewer", "admin"],
    delete: ["owner", "admin"],
  },
  // The shared index of teacher folders in the submissions area. A teacher
  // submitting a plan lands it in their own folder, so creating one cannot be
  // admin-only — but deleting one moves every plan inside it, which is how a
  // stray delete emptied the area once already, so that stays with admins.
  submitted_folders: {
    owner: null,
    read: ["signedIn"],
    write: ["signedIn"],
    delete: ["admin"],
  },
  // The row that decides who is an admin, so what may be written to it is
  // what stops a teacher promoting themselves. Roles are admin-only; uid and
  // email come from the verified token; removing a member is admin-only.
  users: {
    owner: "uid",
    read: ["owner", "admin"],
    write: ["owner", "admin"],
    delete: ["admin"],
    adminOnlyFields: ["roles"],
    tokenFields: { uid: "uid", email: "email" },
  },
  // Timetable and cover assignments: everyone reads, admins write.
  school_config: {
    owner: null,
    read: ["signedIn"],
    write: ["admin"],
    delete: ["admin"],
  },
};

const REVIEWER_ROLES = ["admin", "hod", "coordinator"];

/* ── Who is an admin ──────────────────────────────────────────────────────
   The role in the database is the answer, and it is what the app itself goes
   by. The address list is a second route in for one reason: roles on a users
   row are now admin-only to write, so without it the first admin on a fresh
   deployment could never be created and nobody could promote them.

   Mirrors ADMIN_EMAILS in src/App.tsx — keep the two in step. Being on the
   @zera.edu.my domain is deliberately NOT enough, matching the app; the
   Firestore rules still admit the whole domain, and that is the one place
   this is tighter than what it replaces rather than the same. */
const ADMIN_EMAILS = new Set([
  "elliot.y@zera.edu.my",
  "shahidah.a@zera.edu.my",
  "zixin.l@zera.edu.my",
  "wafi.a@zera.edu.my",
  "lalitha.r@zera.edu.my",
  "nanthini.r@zera.edu.my",
  "roshini.m@zera.edu.my",
  "shiryn.g@zera.edu.my",
  "carol.p@zera.edu.my",
]);

const isAdminEmail = (email: string): boolean =>
  ADMIN_EMAILS.has(email.trim().toLowerCase());

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
  async function authenticate(req: Request): Promise<Actor> {
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

  const isReviewer = (caller: Actor) =>
    caller.roles.some((r) => REVIEWER_ROLES.includes(r));

  const isAdmin = (caller: Actor) =>
    caller.roles.includes("admin") || isAdminEmail(caller.email);

  /** Does the caller hold a grant covering rows that are not theirs?
   *  "owner" is excluded on purpose — it is a row-level test, applied by the
   *  ownership filter rather than here. */
  const holdsAll = (grants: Grant[], caller: Actor): boolean =>
    grants.some(
      (g) =>
        g === "signedIn" ||
        (g === "admin" && isAdmin(caller)) ||
        (g === "reviewer" && isReviewer(caller)),
    );

  /** Whether the caller may reach their OWN rows under this grant list. */
  const holdsOwn = (grants: Grant[], rule: TableRule): boolean =>
    !!rule.owner && grants.includes("owner");

  const forbid = (): never => {
    throw Object.assign(new Error("Not allowed"), { status: 403 });
  };

  /** Strip what this caller may not set, and stamp what only the token may
   *  decide. Applied to every write, so neither put nor patch can be used to
   *  reach a column the other one guards.
   *
   *  `id` is the row being written. Identity columns are stamped from the
   *  token only when that row is the caller's own — an admin editing another
   *  member's roles must not have their own uid and address written over the
   *  member's, which on a uid-keyed table would move the row rather than
   *  edit it. */
  const vetFields = (
    rule: TableRule,
    caller: Actor,
    id: string,
    fields: Record<string, any>,
  ): Record<string, any> => {
    const clean = { ...fields };
    if (rule.adminOnlyFields && !isAdmin(caller)) {
      // Dropped, not refused: the write is legitimate, this part of it is
      // simply not the caller's to make. Both drivers update only the columns
      // they are handed, so the stored value stays as it was.
      for (const field of rule.adminOnlyFields) delete clean[field];
    }
    // tokenFields is only meaningful where the row id IS the uid, which is
    // the one table that sets it.
    if (rule.tokenFields && String(id) === caller.uid) {
      if (rule.tokenFields.uid) clean[rule.tokenFields.uid] = caller.uid;
      // Only when the token carries an address; not every sign-in method
      // supplies one, and blanking a stored address is worse than leaving it.
      if (rule.tokenFields.email && caller.email) {
        clean[rule.tokenFields.email] = caller.email;
      }
    }
    return clean;
  };

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
      const mayReadAll = holdsAll(rule.read, caller);
      if (!mayReadAll && !holdsOwn(rule.read, rule)) forbid();

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
      const idCol = idColumnFor(table);

      const data = await driver!.get(table, idCol, id);
      if (!data) return res.json({ row: null });

      const mayRead =
        holdsAll(rule.read, caller) ||
        (holdsOwn(rule.read, rule) && data[rule.owner!] === caller.uid);
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

      const mayWriteAll = holdsAll(rule.write, caller);
      if (!mayWriteAll && !holdsOwn(rule.write, rule)) forbid();

      const idCol = idColumnFor(table);
      const record: Record<string, any> = {
        ...vetFields(rule, caller, id, row || {}),
        [idCol]: id,
      };
      // Stamped by the SERVER so a watcher cannot be fooled into skipping a
      // change by a client that forgot, or declined, to move it forward — and
      // only where the column exists, because stamping one that does not fails
      // the entire write and no teacher could save.
      if (await driver!.supportsStamps(table)) record.updated_at = Date.now();
      // The owner is stamped from the verified token, never from the body, so
      // a put aimed at someone else's id lands on the caller's own row instead
      // of overwriting theirs. An admin managing another member keeps the id
      // they asked for, which is the whole point of the wider grant.
      if (rule.owner && !mayWriteAll) record[rule.owner] = caller.uid;

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
      const idCol = idColumnFor(table);

      // A teacher may only patch their own rows; a reviewer may move a
      // submission through the approval flow.
      const mayWriteAll = holdsAll(rule.write, caller);
      if (!mayWriteAll && !holdsOwn(rule.write, rule)) forbid();

      const pinOwner =
        rule.owner && !mayWriteAll
          ? ([rule.owner, caller.uid] as [string, unknown])
          : undefined;
      const patched = vetFields(rule, caller, id, changes || {});
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
      const idCol = idColumnFor(table);

      // Deleting is its own grant. A reviewer editing a submission does not
      // get to destroy one, and nobody reaches a row they could not read:
      // without a delete-all grant the ownership pin makes the statement a
      // no-op on anyone else's row.
      const mayDeleteAll = holdsAll(rule.delete, caller);
      if (!mayDeleteAll && !holdsOwn(rule.delete, rule)) forbid();

      const pinOwner =
        rule.owner && !mayDeleteAll
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
