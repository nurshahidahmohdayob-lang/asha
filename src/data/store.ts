/* ═══════════ The one place the app talks to a database ═══════════════════
   Every read and write in the app goes through this module. Today each
   function forwards straight to Firestore and behaves exactly as the code it
   replaced — this step is deliberately a no-op, so it can ship and be proved
   harmless before anything actually moves.

   When the Supabase backend lands it is swapped in behind these same
   functions, so the app itself does not change and the switch can be flipped
   back instantly if anything misbehaves.

   Auth is NOT here. Teacher accounts stay on Firebase, so nobody has to
   re-register and no passwords are at risk. */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy as fsOrderBy,
  query,
  setDoc,
  updateDoc,
  where as fsWhere,
  type Firestore,
} from "firebase/firestore";

import { createSupabaseStore, type TokenGetter } from "./supabase-store";

/** Which backend is serving the app. Flipped in one place when Supabase is
 *  ready; until then this is the only supported value. */
export type Backend = "firestore" | "supabase";
export const ACTIVE_BACKEND: Backend = "supabase";

export type WhereClause = [field: string, op: "==", value: unknown];
export type OrderClause = [field: string, dir: "asc" | "desc"];

export type ListOptions = {
  where?: WhereClause[];
  /** Ordering is applied in the browser, never in the query.
   *
   *  A Firestore query that filters on one field and orders by another needs a
   *  composite index, and without one the whole listener fails — which is how
   *  every saved project silently vanished from this app once already. Sorting
   *  a teacher's own records here costs nothing and cannot fail. */
  orderBy?: OrderClause;
};

export type Row = Record<string, any> & { id: string };

/* ── Helpers ───────────────────────────────────────────────────────────── */

const sortRows = (rows: Row[], order?: OrderClause): Row[] => {
  if (!order) return rows;
  const [field, dir] = order;
  return [...rows].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    // Undefined sorts last whichever way the list is going.
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    const cmp = av > bv ? 1 : -1;
    return dir === "desc" ? -cmp : cmp;
  });
};

const matches = (row: Row, clauses?: WhereClause[]): boolean =>
  !clauses?.length || clauses.every(([field, , value]) => row?.[field] === value);

/* ── The API the app uses ──────────────────────────────────────────────── */

function createFirestoreStore(db: Firestore) {
  const buildQuery = (table: string, opts?: ListOptions) => {
    const parts = (opts?.where || []).map(([f, , v]) => fsWhere(f, "==", v));
    return parts.length
      ? query(collection(db, table), ...parts)
      : query(collection(db, table));
  };

  return {
    backend: ACTIVE_BACKEND,

    /** Create or overwrite one record at a known id. */
    async put(
      table: string,
      id: string,
      data: Record<string, any>,
      opts?: { merge?: boolean },
    ): Promise<void> {
      await setDoc(doc(db, table, id), data, { merge: !!opts?.merge });
    },

    /** Patch fields on an existing record. */
    async patch(
      table: string,
      id: string,
      changes: Record<string, any>,
    ): Promise<void> {
      await updateDoc(doc(db, table, id), changes);
    },

    /** Create a record with a generated id, and return that id. */
    async add(table: string, data: Record<string, any>): Promise<string> {
      const ref = await addDoc(collection(db, table), data);
      return ref.id;
    },

    async remove(table: string, id: string): Promise<void> {
      await deleteDoc(doc(db, table, id));
    },

    async get(table: string, id: string): Promise<Row | null> {
      const snap = await getDoc(doc(db, table, id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as Row) : null;
    },

    async list(table: string, opts?: ListOptions): Promise<Row[]> {
      const snap = await getDocs(buildQuery(table, opts));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Row);
      return sortRows(rows, opts?.orderBy);
    },

    /** Live results. Returns the unsubscribe function.
     *
     *  `fromCache` is passed through because the app uses it to tell a real
     *  server response from a cached one when deciding if it is online. */
    watch(
      table: string,
      opts: ListOptions | undefined,
      onRows: (rows: Row[], meta: { fromCache: boolean }) => void,
      onError?: (err: any) => void,
    ): () => void {
      return onSnapshot(
        buildQuery(table, opts),
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Row);
          onRows(sortRows(rows, opts?.orderBy), {
            fromCache: snap.metadata.fromCache,
          });
        },
        (err) => onError?.(err),
      );
    },

    /** Live results for ONE record. Returns the unsubscribe function.
     *
     *  The timetable and the covers log are single shared documents the whole
     *  school watches, so they need this rather than a collection listener. */
    watchDoc(
      table: string,
      id: string,
      onRow: (row: Row | null, meta: { fromCache: boolean }) => void,
      onError?: (err: any) => void,
    ): () => void {
      return onSnapshot(
        doc(db, table, id),
        (snap) =>
          onRow(snap.exists() ? ({ id: snap.id, ...snap.data() }) as Row : null, {
            fromCache: snap.metadata.fromCache,
          }),
        (err) => onError?.(err),
      );
    },

    /** Escape hatch for the few places still holding a Firestore handle —
     *  timetable config and the professional development log. Everything
     *  reachable through the functions above must not use this. */
    _firestore: db,
  };
}

/** The store the app uses. Which backend answers is decided here and nowhere
 *  else, so flipping ACTIVE_BACKEND is the whole switch.
 *
 *  `getToken` returns the signed-in teacher's Firebase ID token. The Supabase
 *  backend needs it on every call — the browser holds no database key, so the
 *  server authenticates the token and talks to Supabase on its behalf. Without
 *  it the app stays on Firestore, which is the safe way round. */
export function createStore(db: Firestore, getToken?: TokenGetter) {
  const base =
    ACTIVE_BACKEND === "supabase" && getToken
      ? createSupabaseStore(getToken)
      : createFirestoreStore(db);

  return {
    ...base,
    backend: ACTIVE_BACKEND,
    /** Escape hatch for the few places still holding a Firestore handle.
     *  Everything reachable through the functions above must not use this. */
    _firestore: db,
  };
}

export type Store = ReturnType<typeof createStore>;

/* Kept for the Supabase step: the tables the app uses, so the schema and the
   row-level security policies can be generated from one list rather than
   rediscovered by grepping. */
export const TABLES = {
  projects: { owner: "userId" },
  folders: { owner: "userId" },
  submitted_plans: { owner: "userId" },
  submitted_folders: { owner: null },
  users: { owner: "uid" },
  school_config: { owner: null },
  professional_development: { owner: "userId" },
} as const;

export const orderByField = fsOrderBy;
