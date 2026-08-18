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
 *  the teacher comes back to the tab. */
const POLL_MS = 15000;

/* ── The store ────────────────────────────────────────────────────────── */

export function createSupabaseStore(getToken: TokenGetter) {
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
      await call("put", { table, id, row: encodeRow(table, row) }, getToken);
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
      await call("patch", { table, id, changes: encoded }, getToken);
    },

    /** Create a record with a generated id, and return that id. */
    async add(table: string, data: Record<string, any>): Promise<string> {
      const id = autoId();
      await call("put", { table, id, row: encodeRow(table, data) }, getToken);
      return id;
    },

    async remove(table: string, id: string): Promise<void> {
      await call("remove", { table, id }, getToken);
    },

    async get(table: string, id: string): Promise<Row | null> {
      const { row } = await call("get", { table, id }, getToken);
      return decodeRow(table, row);
    },

    async list(table: string, opts?: ListOptions): Promise<Row[]> {
      return readList(table, opts);
    },

    /** Live results, by polling. Returns the unsubscribe function.
     *
     *  `fromCache` is always false: every row here came from the server just
     *  now, which is what the app uses the flag to decide. */
    watch(
      table: string,
      opts: ListOptions | undefined,
      onRows: (rows: Row[], meta: { fromCache: boolean }) => void,
      onError?: (err: any) => void,
    ): () => void {
      let stopped = false;
      let inFlight = false;

      const tick = async () => {
        if (stopped || inFlight) return;
        inFlight = true;
        try {
          const rows = await readList(table, opts);
          if (!stopped) onRows(rows, { fromCache: false });
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
          const { row } = await call("get", { table, id }, getToken);
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
