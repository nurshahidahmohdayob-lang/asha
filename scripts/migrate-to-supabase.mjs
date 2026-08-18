/* ═══════════ One-off: copy Firestore into Supabase ═══════════════════════
   Reads every collection the app uses and writes the same records into the
   Supabase tables schema.sql created. Safe to re-run: rows are upserted on
   their primary key, so a second pass overwrites rather than duplicates.

   Auth stays on Firebase, so this signs in as a real account to read — the
   Firestore rules still apply to it. Use an admin account, or the reviewer
   collections will come back partly empty.

   Usage:
     node scripts/migrate-to-supabase.mjs --dry-run     # count only, no writes
     node scripts/migrate-to-supabase.mjs               # copy for real
     node scripts/migrate-to-supabase.mjs --only projects,folders

   Needs in .env (on top of SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
     MIGRATE_EMAIL=admin@yourschool...
     MIGRATE_PASSWORD=...
   Those two are read only by this script and can be deleted afterwards. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const onlyArg = argv.find((a) => a.startsWith("--only"));
const ONLY = onlyArg
  ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : argv[argv.indexOf(onlyArg) + 1] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

/* ── App shape → column shape ─────────────────────────────────────────────
   Must stay in step with COLUMNS in src/data/supabase-store.ts. The jsonb
   `data` column holds the record exactly as the app wrote it; these columns
   are lifted copies the database filters and sorts on. */
const COLUMNS = {
  projects: {
    userId: "user_id", folderId: "folder_id", title: "title", category: "category",
    status: "status", teacherName: "teacher_name", timestamp: "timestamp",
  },
  folders: {
    userId: "user_id", name: "name", timestamp: "timestamp",
  },
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

const TABLES = Object.keys(COLUMNS);

const idColumn = (table) =>
  table === "users" ? "uid" : table === "professional_development" ? "user_id" : "id";

const NEEDS_TIMESTAMP = new Set(["projects", "folders", "submitted_plans"]);
/** user_id is NOT NULL on these; a row without one cannot be moved across. */
const NEEDS_OWNER = new Set(["projects", "folders", "submitted_plans", "professional_development"]);

/** Firestore Timestamps and other class instances have to become plain JSON. */
const plain = (value) => {
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

const encodeRow = (table, id, doc) => {
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
  return row;
};

/* ── Go ───────────────────────────────────────────────────────────────── */

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
  return v;
};

const firebaseConfig = JSON.parse(
  readFileSync(path.join(root, "firebase-applet-config.json"), "utf8"),
);

const supabase = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log(DRY ? "DRY RUN — nothing will be written.\n" : "Copying Firestore → Supabase.\n");

await signInWithEmailAndPassword(
  getAuth(app),
  need("MIGRATE_EMAIL"),
  need("MIGRATE_PASSWORD"),
).catch((e) => {
  console.error(`Could not sign in to Firebase: ${e.message}`);
  process.exit(1);
});

let totalRead = 0;
let totalWritten = 0;
let totalSkipped = 0;
const problems = [];

for (const table of TABLES) {
  if (ONLY && !ONLY.includes(table)) continue;

  let docs;
  try {
    const snap = await getDocs(collection(db, table));
    docs = snap.docs;
  } catch (e) {
    problems.push(`${table}: could not read from Firestore — ${e.message}`);
    console.log(`${table.padEnd(26)} read failed: ${e.message}`);
    continue;
  }

  const rows = [];
  let skipped = 0;
  for (const d of docs) {
    const row = encodeRow(table, d.id, d.data());
    if (NEEDS_OWNER.has(table) && !row.user_id) {
      // Ownership is not optional on these tables and cannot be invented.
      skipped++;
      problems.push(`${table}/${d.id}: no userId, skipped`);
      continue;
    }
    rows.push(row);
  }

  totalRead += docs.length;
  totalSkipped += skipped;

  if (!DRY && rows.length) {
    // In batches, so one oversized request cannot fail the whole table.
    const SIZE = 200;
    for (let i = 0; i < rows.length; i += SIZE) {
      const chunk = rows.slice(i, i + SIZE);
      const { error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: idColumn(table) });
      if (error) {
        problems.push(`${table}: write failed at row ${i} — ${error.message}`);
        console.log(`${table.padEnd(26)} write failed: ${error.message}`);
        break;
      }
      totalWritten += chunk.length;
    }
  }

  console.log(
    `${table.padEnd(26)} ${String(docs.length).padStart(5)} read` +
      (skipped ? `  ${skipped} skipped` : "") +
      (DRY ? "" : `  → ${rows.length} written`),
  );
}

console.log(
  `\n${totalRead} read, ${DRY ? 0 : totalWritten} written, ${totalSkipped} skipped.`,
);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log(`  - ${p}`);
  if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
}
process.exit(problems.length ? 1 : 0);
