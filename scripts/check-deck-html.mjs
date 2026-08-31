/* The script inside the downloaded lesson is a STRING in deckHtml.ts, so no
   build step ever parses it. One unescaped apostrophe in it shipped a file
   that opened completely blank: nothing ran, so no slide was ever shown.
 *
 * This builds the module for real, generates a file, and parses the script
 * that actually ends up in it. Checking the TypeScript source by hand instead
 * is what let that apostrophe through — a template literal eats a backslash
 * before the browser sees it, so the source and the shipped script are not
 * the same text. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const out = path.join(os.tmpdir(), `deckHtml-${process.pid}.mjs`);
execFileSync("npx", ["esbuild", "src/utils/deckHtml.ts", "--bundle",
  "--format=esm", `--outfile=${out}`, "--log-level=error"], { stdio: "inherit" });

globalThis.document = { styleSheets: [] };
const { buildProjectedDeckHTML } = await import(out);
const html = buildProjectedDeckHTML(['<div data-zx-timer="180">slide</div>'], "Check");
fs.rmSync(out, { force: true });

const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) fail("the exported file has no script at all");
try { new Function(script); } catch (e) { fail(`the exported script will not parse — ${e.message}`); }

// A regex whose backslashes were eaten still parses; it just matches the
// wrong thing. These are the ones the file relies on.
for (const bad of ["[^s]+", "/sborder-sky", "sbg-["]) {
  if (script.includes(bad))
    fail(`a backslash was swallowed by the template literal: ${bad}`);
}
if (!/zxShow\(0\)/.test(script)) fail("nothing shows the first slide");

function fail(why) { console.error(`✗ ${why}`); process.exit(1); }
console.log(`✓ exported lesson is sound — ${script.split("\n").length} lines of runtime`);
