// Vercel serverless function: the SSO callback Commun redirects to.
//
// The registered callback URL is /auth/callback (no /api prefix) — it is an
// allowlist of exactly one on Commun's side and is never taken from a request
// parameter, so it cannot be changed per-request. vercel.json rewrites that
// path here, ahead of the SPA catch-all that would otherwise swallow it.
//
// As with api/data/[action].ts, the logic is NOT reimplemented here.
// server/commun-sso.ts is pre-bundled into api/_lib/commun-sso.js by the build
// step and its handler is used verbatim, so ticket verification, the
// single-use guard and shadow-user matching exist in one place and cannot
// drift between the dev server and the deployment.
//
// Required Vercel env vars (Project → Settings → Environment Variables):
//   COMMUN_CLIENT_ID            — the client_id from School Admin → Connected Systems
//   COMMUN_MACHINE_TOKEN        — server only; back-channel reads
//   COMMUN_SCHOOL_URL           — defaults to the Zera school portal
//   FIREBASE_SERVICE_ACCOUNT    — service-account JSON, for minting the sign-in token
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — the replay guard's storage
// @ts-ignore — generated at build time
import { ssoCallbackHandler } from "../_lib/commun-sso.js";
// @ts-ignore — generated at build time
import { createDriver } from "../_lib/commun-sso.js";

// Once per cold start. A missing database is reported by the handler as a
// refused sign-in rather than a crash, because without one a replayed ticket
// could not be detected and letting it through is the worse failure.
const { driver } = createDriver();
const handle = ssoCallbackHandler(driver);

export const config = { maxDuration: 15 };

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    await handle(req, res);
  } catch (err: any) {
    // The handler answers its own failures with a redirect; this only catches
    // a throw that escaped one, which would otherwise be an opaque 500 landing
    // on a teacher mid-sign-in.
    if (!res.headersSent) {
      res.statusCode = 302;
      res.setHeader("Location", "/?sso_error=verification_failed");
      res.end();
    }
    console.error("[sso] callback crashed:", err?.message || err);
  }
}
