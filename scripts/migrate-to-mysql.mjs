/* ═══════════ One-off: copy Firestore into MySQL ═════════════════════════
   Same job as migrate-to-supabase.mjs, same shaping (scripts/_shape.mjs), a
   different destination. Safe to re-run: rows are upserted on their primary
   key, so a second pass overwrites rather than duplicates.

   Reads Firestore with a service account, so no teacher's password is needed
   and the Firestore rules do not apply — every collection comes back whole.
   Get the key: Firebase console → Project Settings → Service Accounts →
   "Generate new private key", saved as service-account.json in the root.

   Needs the SSH tunnel up, because MySQL is not exposed to the internet:
     ssh -i ~/.ssh/id_ed25519 -N -L 3307:127.0.0.1:3306 zeradev@<host>

   And DATABASE_URL in .env pointing at the local end of it:
     DATABASE_URL=mysql://sha:PASSWORD@127.0.0.1:3307/zera-education-suite

   Usage:
     node scripts/migrate-to-mysql.mjs --dry-run     # count only, no writes
     node scripts/migrate-to-mysql.mjs               # copy for real
     node scripts/migrate-to-mysql.mjs --only projects,folders */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { TABLES, idColumn, encodeRow, NEEDS_OWNER } from "./_shape.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const onlyArg = argv.find((a) => a.startsWith("--only"));
const ONLY = onlyArg
  ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : argv[argv.indexOf(onlyArg) + 1] || "")
      .split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const need = (name) => {
  const v = process.env[name];
  if (!v) { console.error(`Missing ${name} in .env`); process.exit(1); }
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

const db = getFirestore(
  initializeApp({ credential: cert(serviceAccount) }),
  firebaseConfig.firestoreDatabaseId,
);

let pool;
try {
  pool = mysql.createPool({ uri: need("DATABASE_URL"), connectionLimit: 4 });
  await pool.query("select 1");
} catch (e) {
  console.error(
    `Could not reach MySQL: ${e.message}\n\n` +
      `Is the SSH tunnel up? It has to be running in another terminal:\n` +
      `  ssh -i ~/.ssh/id_ed25519 -N -L 3307:127.0.0.1:3306 zeradev@<host>`,
  );
  process.exit(1);
}

console.log(DRY ? "DRY RUN — nothing will be written.\n" : "Copying Firestore → MySQL.\n");
console.log(`Firebase project ${serviceAccount.project_id}, database ${firebaseConfig.firestoreDatabaseId}\n`);

const q = (name) => `\`${String(name).replace(/`/g, "")}\``;
/** JSON columns go in as strings; everything else as-is. */
const bind = (col, v) =>
  (col === "data" || col === "roles") && v !== null && typeof v === "object"
    ? JSON.stringify(v)
    : v;

let totalRead = 0, totalWritten = 0, totalSkipped = 0;
const problems = [];

for (const table of TABLES) {
  if (ONLY && !ONLY.includes(table)) continue;

  let docs;
  try {
    docs = (await db.collection(table).get()).docs;
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
      skipped++;
      problems.push(`${table}/${d.id}: no userId, skipped`);
      continue;
    }
    rows.push(row);
  }

  totalRead += docs.length;
  totalSkipped += skipped;

  if (!DRY) {
    for (const row of rows) {
      const cols = Object.keys(row);
      try {
        await pool.query(
          `insert into ${q(table)} (${cols.map(q).join(",")}) ` +
            `values (${cols.map(() => "?").join(",")}) ` +
            `on duplicate key update ` +
            cols.map((c) => `${q(c)} = values(${q(c)})`).join(","),
          cols.map((c) => bind(c, row[c])),
        );
        totalWritten++;
      } catch (e) {
        // Row by row rather than in batches: one bad record names itself
        // instead of taking a whole table's write down with it.
        problems.push(`${table}/${row[idColumn(table)]}: ${e.message}`);
      }
    }
  }

  console.log(
    `${table.padEnd(26)} ${String(docs.length).padStart(5)} read` +
      (skipped ? `  ${skipped} skipped` : "") +
      (DRY ? "" : `  → ${rows.length} written`),
  );
}

console.log(`\n${totalRead} read, ${DRY ? 0 : totalWritten} written, ${totalSkipped} skipped.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log(`  - ${p}`);
  if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
}

await pool.end();
process.exit(problems.length ? 1 : 0);
