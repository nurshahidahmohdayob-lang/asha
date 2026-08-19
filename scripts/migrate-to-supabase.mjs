/* ═══════════ One-off: copy Firestore into Supabase ═══════════════════════
   Reads every collection the app uses and writes the same records into the
   Supabase tables schema.sql created. Safe to re-run: rows are upserted on
   their primary key, so a second pass overwrites rather than duplicates.

   Reads with a Firebase service account, so no teacher's password is needed
   and the Firestore rules do not apply — every collection comes back whole,
   which is what a migration needs.

   Get the key: Firebase console → Project Settings → Service Accounts →
   "Generate new private key". Save the download as service-account.json in the
   project root. It is gitignored, and grants full access to the Firebase
   project, so delete it once the migration is done.

   Usage:
     node scripts/migrate-to-supabase.mjs --dry-run     # count only, no writes
     node scripts/migrate-to-supabase.mjs               # copy for real
     node scripts/migrate-to-supabase.mjs --only projects,folders

   Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, and
   service-account.json (or SERVICE_ACCOUNT_PATH pointing elsewhere). */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

/* Row shaping lives in scripts/_shape.mjs, shared with migrate-to-mysql.mjs so
   the two cannot drift apart. */
import {
  TABLES, idColumn, encodeRow, NEEDS_OWNER,
} from "./_shape.mjs";

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

const keyPath = process.env.SERVICE_ACCOUNT_PATH
  ? path.resolve(root, process.env.SERVICE_ACCOUNT_PATH)
  : path.join(root, "service-account.json");

if (!existsSync(keyPath)) {
  console.error(
    `No service account key at ${keyPath}\n\n` +
      `Firebase console → Project Settings → Service Accounts →\n` +
      `"Generate new private key", then save the download there.`,
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== firebaseConfig.projectId) {
  console.error(
    `That key belongs to Firebase project "${serviceAccount.project_id}", ` +
      `but this app uses "${firebaseConfig.projectId}".`,
  );
  process.exit(1);
}

const supabase = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log(DRY ? "DRY RUN — nothing will be written.\n" : "Copying Firestore → Supabase.\n");
console.log(`Firebase project ${serviceAccount.project_id}, database ${firebaseConfig.firestoreDatabaseId}\n`);

let totalRead = 0;
let totalWritten = 0;
let totalSkipped = 0;
const problems = [];

for (const table of TABLES) {
  if (ONLY && !ONLY.includes(table)) continue;

  let docs;
  try {
    const snap = await db.collection(table).get();
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

  // The change marker is optional — supabase/updated-at.sql may not have been
  // run. Stripping it where the column is absent keeps the migration working
  // either way, rather than failing every table on a column nobody needs yet.
  const { error: probe } = await supabase.from(table).select("updated_at").limit(1);
  if (probe) for (const row of rows) delete row.updated_at;

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
