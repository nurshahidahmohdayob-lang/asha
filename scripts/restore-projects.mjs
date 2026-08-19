/* One-off: put back projects that exist in Supabase but not in Firestore.
   Written for the folder-delete bug that removed every unfiled project of one
   teacher. The `data` column holds the record exactly as the app wrote it, so
   restoring is writing that object back under its original id.
   node scripts/restore-projects.mjs --dry-run | --write */
import path from "node:path"; import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
const WRITE = process.argv.includes("--write");

const cfg = JSON.parse(readFileSync(path.join(root, "firebase-applet-config.json"), "utf8"));
const sa = JSON.parse(readFileSync(path.join(root, "service-account.json"), "utf8"));
const db = getFirestore(initializeApp({ credential: cert(sa) }), cfg.firestoreDatabaseId);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const present = new Set((await db.collection("projects").get()).docs.map(d => d.id));
const { data, error } = await sb.from("projects").select("id,data");
if (error) { console.error(error.message); process.exit(1); }

const missing = data.filter(r => !present.has(r.id));
console.log(WRITE ? "RESTORING\n" : "DRY RUN — nothing will be written\n");
console.log(`Firestore has ${present.size}; ${missing.length} to restore\n`);

let done = 0;
for (const r of missing) {
  const doc = { ...(r.data || {}) };
  delete doc.updatedAt;               // a database column, not part of the record
  const title = String(doc.title || "").slice(0, 40);
  if (WRITE) {
    await db.collection("projects").doc(r.id).set(doc);
    done++;
  }
  console.log(`  ${WRITE ? "restored" : "would restore"}  ${r.id}  "${title}"`);
}
if (WRITE) console.log(`\n${done} restored. Firestore now has ${(await db.collection("projects").count().get()).data().count}.`);
