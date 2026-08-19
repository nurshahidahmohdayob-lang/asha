/* Firestore document → database row, shared by the migration scripts.
   Must stay in step with COLUMNS in src/data/supabase-store.ts. The `data`
   column holds the record exactly as the app wrote it; the columns below are
   lifted copies the database filters and sorts on. */

export const COLUMNS = {
  projects: {
    userId: "user_id", folderId: "folder_id", title: "title", category: "category",
    status: "status", teacherName: "teacher_name", timestamp: "timestamp",
  },
  folders: { userId: "user_id", name: "name", timestamp: "timestamp" },
  submitted_plans: {
    userId: "user_id", folderId: "folder_id", title: "title", category: "category",
    status: "status", reviewStage: "review_stage", teacherName: "teacher_name",
    subject: "subject", yearGroup: "year_group", weekId: "week_id", timestamp: "timestamp",
  },
  submitted_folders: {
    name: "name", teacherFolder: "teacher_folder", createdBy: "created_by",
    createdAt: "created_at",
  },
  users: {
    uid: "uid", email: "email", teacherName: "teacher_name", roles: "roles",
    createdAt: "created_at",
  },
  school_config: {},
  professional_development: { userId: "user_id" },
};

export const TABLES = Object.keys(COLUMNS);

export const idColumn = (table) =>
  table === "users" ? "uid" : table === "professional_development" ? "user_id" : "id";

const NEEDS_TIMESTAMP = new Set(["projects", "folders", "submitted_plans"]);
/** user_id is NOT NULL on these; a row without one cannot be moved across. */
export const NEEDS_OWNER = new Set([
  "projects", "folders", "submitted_plans", "professional_development",
]);

/** Firestore Timestamps and other class instances have to become plain JSON. */
export const plain = (value) => {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain).filter((v) => v !== undefined);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const p = plain(v);
    if (p !== undefined) out[k] = p;
  }
  return out;
};

export const encodeRow = (table, id, doc) => {
  const map = COLUMNS[table];
  const clean = plain(doc) || {};
  delete clean.id;

  const row = { data: clean, [idColumn(table)]: id };
  for (const [field, col] of Object.entries(map)) {
    if (clean[field] !== undefined) row[col] = clean[field];
  }
  if (NEEDS_TIMESTAMP.has(table) && row.timestamp === undefined) {
    // A record with no timestamp sorts last rather than failing the insert.
    row.timestamp = 0;
  }
  if (table === "professional_development" && row.user_id === undefined) {
    row.user_id = id; // the document id IS the uid for this collection
  }
  // The change marker watchers poll on. Seeded from the record's own time so
  // the first poll after a migration has a baseline rather than nulls.
  row.updated_at = Number(row.timestamp) || Number(row.created_at) || 0;
  return row;
};
