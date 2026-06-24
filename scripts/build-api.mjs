// Bundles src/services/geminiService.ts into a single self-contained ESM file
// at api/_lib/geminiService.js, which the Vercel serverless functions import.
// Why a pre-bundle: Vercel only transpiles api/* functions (it does not bundle
// their cross-directory src import), so importing ../../src/... left a bare ESM
// specifier that crashed at runtime with "Cannot find module".
//
// The createRequire banner is essential: some transitive deps do a dynamic
// require() (e.g. child_process). esbuild's ESM output throws "Dynamic require
// of X is not supported" unless a real `require` exists in scope — createRequire
// provides one, and esbuild's __require shim then uses it.
import { build } from "esbuild";

await build({
  entryPoints: ["src/services/geminiService.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: "api/_lib/geminiService.js",
  banner: {
    js: "import { createRequire as __vcr } from 'module'; const require = __vcr(import.meta.url);",
  },
});

console.log("✓ Bundled api/_lib/geminiService.js");
