/* ═══════════ The Supabase side of the store ══════════════════════════════
   Same functions as the Firestore store, same shapes in and out, so the app
   above never learns which one is serving it.

   The browser holds no database key. Every call goes to this app's own server
   with the teacher's Firebase ID token attached; the server verifies it, works
   out who is asking, and only then talks to Supabase with the service_role
   key. See server/data-api.ts. */

import type { ListOptions, OrderClause, Row, WhereClause } from "./store";

/* ── App shape ↔ column shape ─────────────────────────────────────────────
   The jsonb `data` column holds the record exactly as the app writes it.
   The columns below are lifted COPIES of fields the database needs to filter
   or sort on, so writing sets both and reading prefers the column — which
   matters for ownership, since the server stamps user_id from the verified
   token and that must win over whatever the browser sent. */

const COLUMNS: Record<string, Record<string, string>> = {
  projects: {
    userId: "user_id",
    folderId: "folder_id",
    title: "title",
    category: "category",
    status: "status",
    teacherName: "teacher_name",
    timestamp: "timestamp",
  },
  folders: {
    userId: "user_id",
    name: "name",
    timestamp: "timestamp",
  },
  submitted_plans: {
    userId: "user_id",
    folderId: "folder_id",
    title: "title",
    category: "category",
    status: "status",
    reviewStage: "review_stage",
    teacherName: "teacher_name",
    subject: "subject",
    yearGroup: "year_group",
    weekId: "week_id",
    timestamp: "timestamp",
  },
  submitted_folders: {
    name: "name",
    teacherFolder: "teacher_folder",
    createdBy: "created_by",
    createdAt: "created_at",
  },
  users: {
    uid: "uid",
    email: "email",
    teacherName: "teacher_name",
    roles: "roles",
    createdAt: "created_at",
  },
  school_config: {},
  professional_development: {
    userId: "user_id",
  },
};

// Every table carries the change marker the watcher polls on, so it belongs in
// each map rather than being repeated seven times above. Without it a decoded
// row has no updatedAt, the first delta poll thinks every row has moved, and
// the whole table is fetched a second time for nothing.
for (const map of Object.values(COLUMNS)) map.updatedAt = "updated_at";

/** Which column carries the record's id. Matches server/data-api.ts. */
const idColumn = (table: string): string =>
  table === "users" ? "uid" : table === "professional_development" ? "user_id" : "id";

/** Tables whose timestamp column is NOT NULL, so a write without one fails. */
const NEEDS_TIMESTAMP = new Set(["projects", "folders", "submitted_plans"]);

/* ── Encoding ─────────────────────────────────────────────────────────── */

/** Firestore was configured with ignoreUndefinedProperties because a lesson
 *  plan is full of fields that are simply absent until something fills them.
 *  JSON drops undefined in objects but turns it into null inside arrays, so
 *  strip it here and keep the two backends writing the same record. */
const stripUndefined = (value: any): any => {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map(stripUndefined);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
};

/** App record → the row the server upserts: lifted columns plus the whole
 *  record in `data`. */
const encodeRow = (table: string, appRow: Record<string, any>): Record<string, any> => {
  const map = COLUMNS[table] || {};
  const clean = stripUndefined({ ...appRow });
  delete clean.id; // the id travels separately; the server stamps the column

  const out: Record<string, any> = { data: clean };
  for (const [field, col] of Object.entries(map)) {
    if (clean[field] !== undefined) out[col] = clean[field];
  }
  if (NEEDS_TIMESTAMP.has(table) && out.timestamp === undefined) {
    out.timestamp = Date.now();
  }
  return out;
};

/** Row from the database → the record the app expects. */
const decodeRow = (table: string, row: Record<string, any> | null): Row | null => {
  if (!row) return null;
  const map = COLUMNS[table] || {};
  const app: Record<string, any> = { ...(row.data || {}) };
  for (const [field, col] of Object.entries(map)) {
    if (row[col] !== undefined && row[col] !== null) app[field] = row[col];
  }
  app.id = row[idColumn(table)];
  return app as Row;
};

/* ── Filtering and ordering ───────────────────────────────────────────────
   Only lifted columns can be filtered in the query. Anything else is filtered
   here, after decoding, so a caller can still ask for it. Ordering is always
   applied in the browser — same reason as the Firestore store: a query that
   filters on one field and orders by another is exactly what made every saved
   project vanish once already. */

const splitWhere = (
  table: string,
  clauses: WhereClause[] | undefined,
): { server: WhereClause[]; local: WhereClause[] } => {
  const map = COLUMNS[table] || {};
  const server: WhereClause[] = [];
  const local: WhereClause[] = [];
  for (const clause of clauses || []) {
    (map[clause[0]] ? server : local).push(clause);
  }
  return { server, local };
};

const sortRows = (rows: Row[], order?: OrderClause): Row[] => {
  if (!order) return rows;
  const [field, dir] = order;
  return [...rows].sort((a, b) => {
    const av = (a as any)?.[field];
    const bv = (b as any)?.[field];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    return (av > bv ? 1 : -1) * (dir === "desc" ? -1 : 1);
  });
};

const matchesLocal = (row: Row, clauses: WhereClause[]): boolean =>
  clauses.every(([field, , value]) => (row as any)?.[field] === value);

/* ── Talking to the server ────────────────────────────────────────────── */

export type TokenGetter = () => Promise<string | null>;

async function call(
  path: string,
  body: Record<string, any>,
  getToken: TokenGetter,
): Promise<any> {
  const token = await getToken();
  if (!token) throw Object.assign(new Error("Not signed in"), { status: 401 });

  const res = await fetch(`/api/data/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(payload?.error || `${path} failed (${res.status})`), {
      status: res.status,
    });
  }
  return payload;
}

/** Firestore generated these; Supabase ids are the app's to choose, and the
 *  same alphabet keeps old and new ids indistinguishable. */
const AUTO_ID_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const autoId = (): string => {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => AUTO_ID_CHARS[b % AUTO_ID_CHARS.length]).join("");
};

/** How often a watcher re-reads. There is no realtime channel here — that
 *  would need a database key in the browser, which is the whole thing this
 *  design avoids — so watching is polling, plus an immediate re-read whenever
 *  the teacher comes back to the tab.
 *
 *  A hidden tab polls not at all. Reviewers leave the queue open all day, and
 *  a background tab re-reading every 15 seconds is pure cost for something
 *  nobody is looking at; coming back to the tab refetches immediately anyway,
 *  so nothing is stale by the time it is seen. */
const POLL_MS = 15000;

const isHidden = (): boolean =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

/** A blank id is never a legitimate target. Left unchecked it becomes a
 *  delete or a patch aimed at whatever the database happens to match, which is
 *  how a folder delete with a missing id removed every unfiled project. Both
 *  backends refuse it here rather than each caller remembering to. */
const requireId = (table: string, id: string): string => {
  if (!id || typeof id !== "string") {
    throw new Error(`A record id is required for "${table}" (got ${JSON.stringify(id)})`);
  }
  return id;
};

/* ── The store ────────────────────────────────────────────────────────── */

export function createSupabaseStore(getToken: TokenGetter) {
  /** Full rows, optionally narrowed to specific ids. */
  const readRows = async (
    table: string,
    where: WhereClause[],
    ids?: string[],
  ): Promise<Row[]> => {
    const map = COLUMNS[table] || {};
    const { rows } = await call(
      "list",
      {
        table,
        where: where.map(([f, op, v]) => [map[f], op, v]),
        ...(ids ? { ids } : {}),
      },
      getToken,
    );
    return (rows || []).map((r: any) => decodeRow(table, r)).filter(Boolean) as Row[];
  };

  const readList = async (table: string, opts?: ListOptions): Promise<Row[]> => {
    const { server, local } = splitWhere(table, opts?.where);
    const map = COLUMNS[table] || {};
    const { rows } = await call(
      "list",
      { table, where: server.map(([f, op, v]) => [map[f], op, v]) },
      getToken,
    );
    const decoded = (rows || [])
      .map((r: any) => decodeRow(table, r))
      .filter(Boolean) as Row[];
    return sortRows(
      local.length ? decoded.filter((r) => matchesLocal(r, local)) : decoded,
      opts?.orderBy,
    );
  };

  return {
    backend: "supabase" as const,

    /** Create or overwrite one record at a known id. */
    async put(
      table: string,
      id: string,
      data: Record<string, any>,
      opts?: { merge?: boolean },
    ): Promise<void> {
      // Firestore's merge:true left untouched fields alone. The server upserts
      // the row wholesale, so read first and merge here to keep that promise.
      let row = data;
      if (opts?.merge) {
        const existing = await this.get(table, id);
        if (existing) {
          const { id: _drop, ...rest } = existing as Record<string, any>;
          row = { ...rest, ...data };
        }
      }
      await call("put", { table, id: requireId(table, id), row: encodeRow(table, row) }, getToken);
    },

    /** Patch fields on an existing record.
     *
     *  `data` holds the whole record, so a patch has to rewrite it — which
     *  means reading it first. Patch rather than put is deliberate: put would
     *  re-stamp ownership from the caller, and a reviewer moving someone
     *  else's submission through the approval flow must not become its owner.
     *
     *  Two teachers patching the same record within the same round trip can
     *  still lose the earlier change; the records here belong to one teacher
     *  each, so that window is not reachable in practice. */
    async patch(
      table: string,
      id: string,
      changes: Record<string, any>,
    ): Promise<void> {
      const existing = await this.get(table, id);
      if (!existing) throw Object.assign(new Error("No such record"), { status: 404 });
      const { id: _drop, ...rest } = existing as Record<string, any>;
      const merged = { ...rest, ...changes };

      const map = COLUMNS[table] || {};
      const encoded: Record<string, any> = { data: stripUndefined(merged) };
      // Only columns the patch actually touches are sent, so nothing else is
      // disturbed by a partial write.
      for (const field of Object.keys(changes)) {
        if (map[field]) encoded[map[field]] = stripUndefined(changes[field]);
      }
      await call("patch", { table, id: requireId(table, id), changes: encoded }, getToken);
    },

    /** Create a record with a generated id, and return that id. */
    async add(table: string, data: Record<string, any>): Promise<string> {
      const id = autoId();
      await call("put", { table, id, row: encodeRow(table, data) }, getToken);
      return id;
    },

    async remove(table: string, id: string): Promise<void> {
      await call("remove", { table, id: requireId(table, id) }, getToken);
    },

    async get(table: string, id: string): Promise<Row | null> {
      const { row } = await call("get", { table, id: requireId(table, id) }, getToken);
      return decodeRow(table, row);
    },

    async list(table: string, opts?: ListOptions): Promise<Row[]> {
      return readList(table, opts);
    },

    /** Live results, by polling. Returns the unsubscribe function.
     *
     *  `fromCache` is always false: every row here came from the server just
     *  now, which is what the app uses the flag to decide. */
    /** Live results. Returns the unsubscribe function.
     *
     *  Only the FIRST poll reads whole rows. After that each poll asks for id
     *  and updated_at alone and fetches full rows for just the ids that are new
     *  or have moved — because a reviewer watches every submission in the
     *  school, and re-reading all of them every 15 seconds is about 1 MB a poll
     *  once a year's submissions have built up, which exhausts the egress
     *  allowance in days. Stamps are tens of bytes a row.
     *
     *  `fromCache` is always false: every row here came from the server, either
     *  on this poll or on the one that last saw it change. */
    watch(
      table: string,
      opts: ListOptions | undefined,
      onRows: (rows: Row[], meta: { fromCache: boolean }) => void,
      onError?: (err: any) => void,
    ): () => void {
      let stopped = false;
      let inFlight = false;
      /** Everything currently known, by id, so a poll need only mend it. */
      let cache = new Map<string, Row>();
      let stamps_ = new Map<string, number>();
      let primed = false;

      const { server, local } = splitWhere(table, opts?.where);
      const emit = () => {
        const rows = [...cache.values()];
        onRows(
          sortRows(
            local.length ? rows.filter((r) => matchesLocal(r, local)) : rows,
            opts?.orderBy,
          ),
          { fromCache: false },
        );
      };

      const tick = async () => {
        if (stopped || inFlight || isHidden()) return;
        inFlight = true;
        try {
          if (!primed) {
            const rows = await readRows(table, server);
            if (stopped) return;
            cache = new Map(rows.map((r) => [r.id, r]));
            stamps_ = new Map(rows.map((r) => [r.id, Number(r.updatedAt) || 0]));
            primed = true;
            emit();
            return;
          }

          const map = COLUMNS[table] || {};
          const { rows: marks, stamps } = await call(
            "list",
            {
              table,
              select: "stamps",
              where: server.map(([f, op, v]) => [map[f], op, v]),
            },
            getToken,
          );

          // The marker column is optional. Where it is absent the server sends
          // full rows and says so, and the honest response is to use them as
          // the whole picture rather than diff against stamps that do not
          // exist. Costs bandwidth; keeps working.
          if (stamps === false) {
            const rows = (marks || [])
              .map((r: any) => decodeRow(table, r))
              .filter(Boolean) as Row[];
            cache = new Map(rows.map((r) => [r.id, r]));
            stamps_.clear();
            emit();
            return;
          }

          const seen = new Map<string, number>();
          const stale: string[] = [];
          for (const m of marks || []) {
            const id = String(m.id ?? m.uid ?? m.user_id);
            const at = Number(m.updated_at) || 0;
            seen.set(id, at);
            if (stamps_.get(id) !== at) stale.push(id);
          }

          // Rows that vanished are dropped; nothing else has to be fetched to
          // know that, which is the other half of what makes this cheap.
          let changed = false;
          for (const id of [...cache.keys()]) {
            if (!seen.has(id)) {
              cache.delete(id);
              stamps_.delete(id);
              changed = true;
            }
          }

          if (stale.length) {
            const fresh = await readRows(table, server, stale);
            if (stopped) return;
            for (const row of fresh) {
              cache.set(row.id, row);
              stamps_.set(row.id, seen.get(row.id) ?? 0);
            }
            // An id that was stale but came back missing was deleted between
            // the two calls; forget it rather than leave it showing.
            const returned = new Set(fresh.map((r) => r.id));
            for (const id of stale) {
              if (!returned.has(id)) {
                cache.delete(id);
                stamps_.delete(id);
              }
            }
            changed = true;
          }

          if (changed) emit();
        } catch (err) {
          if (!stopped) onError?.(err);
        } finally {
          inFlight = false;
        }
      };

      void tick();
      const timer = setInterval(tick, POLL_MS);
      // Coming back to the tab refetches at once, so a tab that polled nothing
      // while hidden is up to date the moment it is looked at again.
      const wake = () => void tick();
      window.addEventListener("focus", wake);
      document.addEventListener("visibilitychange", wake);

      return () => {
        stopped = true;
        clearInterval(timer);
        window.removeEventListener("focus", wake);
        document.removeEventListener("visibilitychange", wake);
      };
    },

    /** Live results for ONE record, by polling. Same reasoning as watch(). */
    watchDoc(
      table: string,
      id: string,
      onRow: (row: Row | null, meta: { fromCache: boolean }) => void,
      onError?: (err: any) => void,
    ): () => void {
      let stopped = false;
      let inFlight = false;

      const tick = async () => {
        if (stopped || inFlight) return;
        inFlight = true;
        try {
          const { row } = await call("get", { table, id: requireId(table, id) }, getToken);
          if (!stopped) onRow(decodeRow(table, row), { fromCache: false });
        } catch (err) {
          if (!stopped) onError?.(err);
        } finally {
          inFlight = false;
        }
      };

      void tick();
      const timer = setInterval(tick, POLL_MS);
      const onFocus = () => void tick();
      window.addEventListener("focus", onFocus);

      return () => {
        stopped = true;
        clearInterval(timer);
        window.removeEventListener("focus", onFocus);
      };
    },
  };
}
