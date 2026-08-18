// Vercel serverless function: the SAME database API the local Express server
// exposes at /api/data/*. Without this, a deployment with ACTIVE_BACKEND set to
// "supabase" has no server to talk to and every read and write 404s — the
// browser holds no database key by design, so there is no fallback.
//
// The handlers are NOT reimplemented here. server/data-api.ts is pre-bundled
// (esbuild) into api/_lib/data-api.js by the build step, and mountDataApi is
// handed a stand-in for the Express app that records its routes instead of
// serving them. Verifying the Firebase token, pinning ownership from that token
// and reading roles from the database therefore exist in exactly one place, and
// cannot drift between local and deployed.
//
// Required Vercel env vars (Project → Settings → Environment Variables):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   — server only. Never expose this to the browser.
// @ts-ignore — generated at build time
import { mountDataApi } from "../_lib/data-api.js";

// The Firebase project whose ID tokens are accepted. Public by design — it is
// in the browser bundle already — so a literal fallback is safe and keeps the
// function working if the env var is ever missing.
const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0358746117";

/** Routes collected from mountDataApi, keyed "METHOD /api/data/thing". */
type Handler = (req: any, res: any) => any;
const routes = new Map<string, Handler>();

// A stand-in for the Express app. mountDataApi only ever calls .get and .post,
// and only to register routes, so recording them is all this has to do.
const collector = {
  get: (path: string, handler: Handler) => routes.set(`GET ${path}`, handler),
  post: (path: string, handler: Handler) => routes.set(`POST ${path}`, handler),
};

// Once per cold start. This is also where the Supabase client is built, so a
// missing key shows up as /api/data/health reporting not configured rather than
// as a crash.
mountDataApi(collector as any, PROJECT_ID);

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  const action = String(req.query?.action || "");
  const route = routes.get(`${req.method} /api/data/${action}`);

  if (!route) {
    res.status(404).json({
      error: `Unknown data action "${action}"`,
      // Naming what IS available turns a typo into a one-line fix.
      available: [...routes.keys()],
    });
    return;
  }

  // Vercel parses JSON bodies already, but a raw string arrives when the
  // content type is anything else, and the handlers expect an object.
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body || "{}");
    } catch {
      res.status(400).json({ error: "Body is not valid JSON" });
      return;
    }
  }
  req.body = req.body || {};

  try {
    await route(req, res);
  } catch (err: any) {
    // The handlers answer their own errors; this only catches a throw that
    // escaped one, which would otherwise surface as an opaque 500 from Vercel.
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  }
}
