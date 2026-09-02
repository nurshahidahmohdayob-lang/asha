// Reports what the SSO integration has and has not been given, without signing
// anyone in. Nothing secret is returned — only whether each piece is present —
// so this is the first thing to open when a handoff fails on a deployment.
// @ts-ignore — generated at build time
import { ssoStatus } from "../_lib/commun-sso.js";

export const config = { maxDuration: 15 };

export default async function handler(_req: any, res: any) {
  try {
    res.status(200).json(await ssoStatus());
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}
