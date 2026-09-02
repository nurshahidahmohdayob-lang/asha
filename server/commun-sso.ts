/* ═══════════ Commun Connected Systems — Single Sign-On ═══════════════════
   A teacher already signed in to the Commun school portal clicks this app and
   arrives ALREADY signed in. Commun mints a short-lived, single-use, RS256
   ticket and redirects the browser to our registered callback; this file is
   what stands at that callback.

   Two halves, per the vendor contract at
   https://zera-education.commun.cloud/docs/vendor-api#sec-connected-systems-single-sign-on-sso

     1. Browser handoff  — verify the ticket, then open OUR session.
     2. Back-channel     — re-read the identity with the machine token, which
                           is also how a disabled account is spotted.

   Commun never calls the callback itself; it only points the browser at it.
   Everything below is therefore OUR side of the contract, and the ticket is
   the only thing we get — so it is checked in full before it decides anything.

   ── How the session is opened ────────────────────────────────────────────
   The rest of the app authenticates with a Firebase ID token: the browser
   sends it, server/data-api.ts verifies it and pins ownership from it. An SSO
   arrival has to end up holding one of those or it can read and write nothing.

   So a verified ticket is exchanged for a Firebase CUSTOM token, which the
   browser trades for a real session (signInWithCustomToken). Nothing else in
   the app changes, and an SSO teacher is a first-class signed-in teacher
   rather than a second kind of user every feature would have to know about.

   The earlier build put the profile in the URL as base64 and had the client
   believe it. That is forgeable by anyone who can type a query string, and it
   yielded no ID token, so it could not save work either. It is gone. */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import type { Express, Request, Response } from "express";
import { createDriver, type DbDriver } from "./db-driver";

// Re-exported so the Vercel functions can build a driver from the same bundle
// they get the handler from, rather than pulling in a second one.
export { createDriver };

/* ── Configuration ────────────────────────────────────────────────────── */

const cfg = () => ({
  schoolUrl: (process.env.COMMUN_SCHOOL_URL || "https://zera-education.commun.cloud")
    .replace(/\/+$/, ""),
  clientId: process.env.COMMUN_CLIENT_ID || "",
  machineToken: process.env.COMMUN_MACHINE_TOKEN || "",
  // The `iss` a ticket actually carries. It is normally the school app URL and
  // defaults to it, but the two are separate settings on Commun's side and
  // nothing guarantees they are spelled identically — so this is an override
  // rather than an assumption baked into the issuer check.
  issuer: (process.env.COMMUN_ISSUER || "").replace(/\/+$/, ""),
});

/** Compare two issuer URLs the way a URL means them rather than the way a
 *  string does: a trailing slash and the scheme/host casing are noise, and
 *  telling a whole school they cannot sign in over one is not a check, it is
 *  a papercut. The path still has to match — that part carries meaning. */
const sameIssuer = (a: string, b: string): boolean => {
  const norm = (v: string) => {
    const trimmed = String(v || "").trim().replace(/\/+$/, "");
    try {
      const u = new URL(trimmed);
      return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      return trimmed.toLowerCase();
    }
  };
  return !!a && !!b && norm(a) === norm(b);
};

/** Tickets live ~60s; the contract allows ~30s of clock skew either way. */
const CLOCK_SKEW_SECONDS = 30;

/** How long a spent ticket id is remembered. The contract asks for at least
 *  ticket-lifetime + leeway; an hour is far past that and costs one small row
 *  per sign-in. */
const JTI_MEMORY_SECONDS = 3600;

export type TicketClaims = {
  iss: string;
  aud: string;
  sub: string | number;
  school_id?: string | number;
  school_slug?: string;
  name?: {
    first_name?: string;
    last_name?: string;
    nric_name?: string;
    preferred_name?: string;
  };
  email?: string | null;
  user_types?: string[];
  locale?: string;
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
};

/** Thrown for anything that means "this handoff is not good". The message is
 *  written to be read by whoever is debugging the integration; it is logged in
 *  full and only summarised to the browser. */
class SsoError extends Error {
  /** A short, fixed code the browser is shown. Free text stays in the log —
   *  the code exists so "it didn't work" can be told apart from "it didn't
   *  work BECAUSE the ticket had expired", which is the difference between
   *  clicking again and calling the administrator. */
  constructor(
    message: string,
    readonly reason: string = "verification_failed",
  ) {
    super(message);
  }
}

/* ── The signing keys ─────────────────────────────────────────────────────
   Commun publishes them at a public JWKS endpoint and may serve more than one
   during a rotation, so the key is chosen by the ticket's `kid` and never
   assumed. Cached because every sign-in would otherwise fetch it again; a
   `kid` we have not seen busts the cache once, which is what makes a rotation
   pick itself up without a deploy. */

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string };

let jwksCache: { keys: Jwk[]; fetchedAt: number } = { keys: [], fetchedAt: 0 };
const JWKS_TTL_MS = 10 * 60 * 1000;

async function fetchJwks(): Promise<Jwk[]> {
  const url = `${cfg().schoolUrl}/api/sso/jwks`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new SsoError(`JWKS fetch failed (${res.status}) from ${url}`, "school_unreachable");
  const body = (await res.json()) as { keys?: Jwk[] };
  if (!Array.isArray(body?.keys) || !body.keys.length) {
    throw new SsoError(`JWKS at ${url} returned no keys`, "school_unreachable");
  }
  return body.keys;
}

async function signingKeyFor(kid: string): Promise<crypto.KeyObject> {
  const fresh = Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  let key = fresh ? jwksCache.keys.find((k) => k.kid === kid) : undefined;

  if (!key) {
    // Either the cache is stale, or it is warm but does not hold this kid —
    // which is exactly what a key rotation looks like from here.
    const keys = await fetchJwks();
    jwksCache = { keys, fetchedAt: Date.now() };
    key = keys.find((k) => k.kid === kid);
  }
  if (!key) {
    throw new SsoError(
      `No published key matches the ticket's kid "${kid}" (JWKS offers: ${jwksCache.keys
        .map((k) => k.kid)
        .join(", ")})`,
      "ticket_invalid",
    );
  }
  if (key.kty !== "RSA") throw new SsoError(`Key "${kid}" is ${key.kty}, expected RSA`, "ticket_invalid");

  // Node builds a public key straight from the JWK, so there is no hand-rolled
  // modulus-to-PEM step here to get subtly wrong.
  return crypto.createPublicKey({ key: key as any, format: "jwk" });
}

/* ── Verifying the ticket ─────────────────────────────────────────────── */

export async function verifyTicket(ticket: string): Promise<TicketClaims> {
  const { clientId, schoolUrl } = cfg();
  if (!clientId) {
    throw new SsoError(
      "COMMUN_CLIENT_ID is not set, so no ticket can be trusted.",
      "not_configured",
    );
  }

  const decoded: any = jwt.decode(ticket, { complete: true });
  if (!decoded?.header) throw new SsoError("Ticket is not a compact JWT.", "ticket_invalid");
  if (decoded.header.alg !== "RS256") {
    // Refusing anything but RS256 here is what stops an "alg": "none" or an
    // HS256 ticket signed with a public value we publish ourselves.
    throw new SsoError(
      `Ticket alg is "${decoded.header.alg}", expected RS256.`,
      "ticket_invalid",
    );
  }
  if (!decoded.header.kid) throw new SsoError("Ticket header carries no kid.", "ticket_invalid");

  const key = await signingKeyFor(String(decoded.header.kid));

  let claims: TicketClaims;
  try {
    // The issuer is deliberately NOT checked here. jsonwebtoken compares it as
    // an exact string and, when it fails, reports only what it EXPECTED — so
    // the one fact needed to fix a mismatch, the value the ticket actually
    // carries, is the one fact it withholds. It is checked below instead.
    claims = jwt.verify(ticket, key, {
      algorithms: ["RS256"],
      audience: clientId,
      clockTolerance: CLOCK_SKEW_SECONDS,
    }) as TicketClaims;
  } catch (err: any) {
    // An expired ticket is the one failure that is nobody's mistake: tickets
    // live about a minute, so a teacher who opened the link and then took a
    // phone call sees exactly this. Telling them to click again is a real
    // answer; "verification failed" sends them to the administrator instead.
    const expired = err?.name === "TokenExpiredError";
    // What the ticket claims, unverified, purely so the log can say how it
    // differed from what was expected. It failed verification, so none of this
    // is trusted for anything — it is only ever printed.
    const seen = decoded.payload || {};
    throw new SsoError(
      `Ticket rejected: ${err?.message || String(err)} ` +
        `[ticket said aud=${JSON.stringify(seen.aud)} iss=${JSON.stringify(seen.iss)}; ` +
        `expected aud=${JSON.stringify(clientId)}]`,
      expired ? "ticket_expired" : "ticket_invalid",
    );
  }

  const expectedIssuer = cfg().issuer || schoolUrl;
  if (!sameIssuer(claims.iss, expectedIssuer)) {
    throw new SsoError(
      `Ticket issuer mismatch: ticket said ${JSON.stringify(claims.iss)}, ` +
        `expected ${JSON.stringify(expectedIssuer)}. If Commun's issuer is ` +
        `genuinely that value, set COMMUN_ISSUER to it.`,
      "ticket_invalid",
    );
  }

  if (!claims.sub && claims.sub !== 0) {
    throw new SsoError("Ticket carries no sub.", "ticket_invalid");
  }
  if (!claims.jti) {
    throw new SsoError(
      "Ticket carries no jti, so single use cannot be enforced.",
      "ticket_invalid",
    );
  }
  return claims;
}

/* ── Single use ───────────────────────────────────────────────────────────
   A ticket may be presented exactly once. The database decides, in one
   statement, so two requests racing the same ticket cannot both win — see
   insertUnique in db-driver.ts.

   With no database configured the process falls back to remembering ids in
   memory. That is honest protection for the dev server and NOT for a
   serverless deployment, where the next request may land in a different
   instance with an empty set, so claimTicket says so out loud. */

const seenInMemory = new Map<string, number>();

async function claimTicket(driver: DbDriver | null, claims: TicketClaims): Promise<void> {
  const jti = String(claims.jti);

  if (!driver) {
    if (process.env.NODE_ENV === "production") {
      throw new SsoError(
        "No database configured, so a replayed ticket could not be detected. " +
          "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or DATABASE_URL) before using SSO.",
        "guard_unavailable",
      );
    }
    const now = Date.now();
    for (const [id, at] of seenInMemory) {
      if (now - at > JTI_MEMORY_SECONDS * 1000) seenInMemory.delete(id);
    }
    if (seenInMemory.has(jti)) {
      throw new SsoError(`Ticket "${jti}" has already been used.`, "ticket_already_used");
    }
    seenInMemory.set(jti, now);
    return;
  }

  let won: boolean;
  try {
    won = await driver.insertUnique("sso_used_tickets", {
      jti,
      used_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + JTI_MEMORY_SECONDS * 1000).toISOString(),
    });
  } catch (err: any) {
    // Refusing the sign-in is the right way to fail here. Letting it through
    // because the guard is missing would mean the one protection the contract
    // is explicit about is silently absent, which is worse than a teacher
    // seeing an error and someone running the migration.
    const missing = /sso_used_tickets/.test(String(err?.message || err));
    throw new SsoError(
      missing
        ? "The sso_used_tickets table does not exist, so single use cannot be enforced. " +
          "Run supabase/sso.sql (or the mysql/schema.sql addition) once against the database."
        : `Ticket guard unavailable: ${err?.message || err}`,
      "guard_unavailable",
    );
  }
  if (!won) {
    throw new SsoError(
      `Ticket "${jti}" has already been used (replay blocked).`,
      "ticket_already_used",
    );
  }
}

/* ── Back-channel identity re-sync ────────────────────────────────────────
   The ticket says who the user is at the moment it was minted. /userinfo says
   who they are NOW, and carries the `active` flag — the only way to learn that
   an account has been disabled, since Commun cannot reach into our session.

   A failure here does not fail the sign-in. The ticket has already been
   verified cryptographically, and refusing a teacher at the door because a
   secondary read timed out trades a real login for a nicety. The one answer
   that DOES stop them is an explicit active:false. */

export type Userinfo = {
  sub: string | number;
  name?: TicketClaims["name"];
  email?: string | null;
  user_types?: string[];
  locale?: string;
  active?: boolean;
};

export async function fetchUserinfo(sub: string | number): Promise<Userinfo | null> {
  const { schoolUrl, machineToken } = cfg();
  if (!machineToken) return null;

  const res = await fetch(`${schoolUrl}/api/v1/userinfo/${encodeURIComponent(String(sub))}`, {
    headers: { Authorization: `Bearer ${machineToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    // 401 means our machine token was rotated or revoked, 403 that the scope
    // was withdrawn. Both are worth seeing in the log, neither is the
    // teacher's fault, so they are reported and not thrown.
    console.warn(`[sso] /userinfo/${sub} returned ${res.status}`);
    return null;
  }
  return (await res.json()) as Userinfo;
}

/* ── Naming ───────────────────────────────────────────────────────────────
   The contract is explicit that `name` is a structured object and never a
   pre-formatted string, so the display name is composed here. Preferred name
   wins where there is one: it is what the teacher is actually called. */

export function displayName(name?: TicketClaims["name"], fallback = "Educator"): string {
  const given = (name?.preferred_name || name?.first_name || "").trim();
  const last = (name?.last_name || "").trim();

  // A preferred name is often the part of the full name the teacher actually
  // goes by, and for a Malay name that part is frequently the SECOND one — so
  // "Nur / Shahidah / Shahidah" would otherwise be introduced to the staffroom
  // as "Shahidah Shahidah". Appending a surname the given name already is, or
  // already ends with, is the only case this drops.
  const redundant =
    !!last &&
    (given.toLowerCase() === last.toLowerCase() ||
      given.toLowerCase().endsWith(` ${last.toLowerCase()}`));

  const joined = [given, redundant ? "" : last].filter(Boolean).join(" ").trim();
  return joined || (name?.nric_name || "").trim() || fallback;
}

/* ── Who this is, in our own database ─────────────────────────────────────
   The contract says to key the shadow user on `sub`, and that is the first
   thing tried — an address can change or be reassigned, a sub cannot.

   But a teacher who has been using this app already HAS an account, with
   folders and submitted plans hanging off its uid. Provisioning them a fresh
   one on their first SSO sign-in would silently empty the app for them, so an
   existing row is matched by address and adopted, and the sub is written onto
   it. That match happens once; from then on the sub is what answers. */

type Resolved = { uid: string; roles: string[]; isNew: boolean };

async function resolveUser(
  driver: DbDriver | null,
  claims: TicketClaims,
  identity: Userinfo | null,
): Promise<Resolved> {
  const sub = String(claims.sub);
  const email = String(identity?.email ?? claims.email ?? "").trim().toLowerCase();
  const fallbackUid = `commun_${sub}`;

  if (!driver) return { uid: fallbackUid, roles: ["educator"], isNew: true };

  // One read serves both lookups. The staff table is small — a school's worth
  // of rows — so scanning it costs less than the two indexed queries plus the
  // case-folding an address match needs would.
  const rows = await driver.list({ table: "users", idCol: "uid", filters: [] });

  const bySub = rows.find((r: any) => {
    const stored = typeof r?.data === "string" ? safeJson(r.data) : r?.data;
    return stored?.commun_sub && String(stored.commun_sub) === sub;
  });
  /* More than one row can carry the same address — a teacher added twice, or
   *  an old record left beside a new one. Taking whichever came back first
   *  meant a coin toss between an account holding a term of work and an empty
   *  duplicate, and losing it looks exactly like the work being deleted.
   *
   *  So the tie is broken deliberately: an account already linked to Commun
   *  wins, then one that owns saved work, then the first. */
  const emailMatches =
    !bySub && email
      ? rows.filter(
          (r: any) => String(r?.email || "").trim().toLowerCase() === email,
        )
      : [];
  const byEmail =
    emailMatches.length > 1
      ? await pickLiveAccount(driver, emailMatches)
      : emailMatches[0];

  /* Last resort: the account that OWNS this teacher's work.
   *
   *  Matching on the users table alone was not enough. A teacher can have
   *  work under a uid that has no users row at all — an account created
   *  before that table was written to, or one whose row carries a
   *  mistyped address ("@zera.edumy") that no email match will ever reach.
   *  Their plans then sit in the database owned by nobody the app can find,
   *  and their own board shows them nothing while the admin portal shows
   *  everything, which reads exactly like the work has been deleted.
   *
   *  The link is the address itself: these records are stamped with a
   *  teacher_name that IS the local part of the school address —
   *  "shahidah.a" for shahidah.a@zera.edu.my. That is an exact match on a
   *  school-issued identifier, not a guess at a person's name, and it is
   *  only ever consulted when nothing else matched. */
  const localPart = email.split("@")[0];
  const byOwnedWork =
    !bySub && !byEmail && localPart
      ? await findUidOwningWork(driver, localPart)
      : "";

  const existing = bySub || byEmail;
  const uid = existing?.uid
    ? String(existing.uid)
    : byOwnedWork || fallbackUid;

  let roles: string[] = ["educator"];
  const stored = typeof existing?.roles === "string" ? safeJson(existing.roles) : existing?.roles;
  if (Array.isArray(stored) && stored.length) roles = stored;

  return { uid, roles, isNew: !existing && !byOwnedWork };
}

/** Of several rows sharing one address, the one that is actually in use.
 *
 *  Linked to Commun already, or holding saved work. An empty duplicate is
 *  the one thing that must not win, because adopting it hands the teacher an
 *  empty app while their real work sits under the account nobody chose. */
async function pickLiveAccount(driver: DbDriver, rows: any[]): Promise<any> {
  const linked = rows.find((r: any) => {
    const stored = typeof r?.data === "string" ? safeJson(r.data) : r?.data;
    return Boolean(stored?.commun_sub);
  });
  if (linked) return linked;

  try {
    const projects = await driver.list({ table: "projects", idCol: "id", filters: [] });
    const owns = new Set(
      (projects as any[]).map((p) => String(p?.user_id || "")).filter(Boolean),
    );
    const working = rows.find((r: any) => owns.has(String(r.uid)));
    if (working) return working;
  } catch (err) {
    console.warn("[sso] could not weigh duplicate accounts:", err);
  }
  return rows[0];
}

/** The uid that already owns saved work stamped with this teacher_name.
 *
 *  Read-only, and deliberately narrow: an exact, case-insensitive match, and
 *  only when every row that matches agrees on one uid. Two uids answering to
 *  the same name is a question, not an answer, and adopting the wrong one
 *  would hand a teacher somebody else's plans — far worse than the empty
 *  board this is fixing. */
async function findUidOwningWork(
  driver: DbDriver,
  teacherName: string,
): Promise<string> {
  const want = teacherName.trim().toLowerCase();
  if (!want) return "";
  try {
    const rows = await driver.list({
      table: "projects",
      idCol: "id",
      filters: [],
    });
    const owners = new Set<string>();
    for (const row of rows as any[]) {
      const name = String(row?.teacher_name ?? "").trim().toLowerCase();
      if (name && name === want && row?.user_id) owners.add(String(row.user_id));
    }
    return owners.size === 1 ? [...owners][0] : "";
  } catch (err) {
    // Never block a sign-in over this. Worst case the teacher gets the fresh
    // account they would have got anyway.
    console.warn("[sso] could not check for existing work:", err);
    return "";
  }
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Write back what Commun now says, without touching what only this app
 *  decides. Roles are deliberately preserved: they are admin-only to change
 *  everywhere else, and `user_types` from a ticket is for provisioning, not a
 *  permission string — the contract says so in as many words. */
async function recordUser(
  driver: DbDriver | null,
  resolved: Resolved,
  claims: TicketClaims,
  identity: Userinfo | null,
  name: string,
): Promise<void> {
  if (!driver) return;
  const email = String(identity?.email ?? claims.email ?? "").trim();

  await driver.upsert("users", "uid", {
    uid: resolved.uid,
    ...(email ? { email } : {}),
    teacher_name: name,
    roles: resolved.roles,
    ...(resolved.isNew ? { created_at: new Date().toISOString() } : {}),
    data: {
      uid: resolved.uid,
      email,
      teacherName: name,
      roles: resolved.roles,
      commun_sub: String(claims.sub),
      commun_school_id: claims.school_id ?? null,
      commun_school_slug: claims.school_slug ?? null,
      commun_user_types: identity?.user_types ?? claims.user_types ?? [],
      locale: identity?.locale ?? claims.locale ?? null,
      lastSsoAt: new Date().toISOString(),
    },
  });
}

/* ── The Firebase custom token ────────────────────────────────────────────
   A custom token is a plain RS256 JWT signed by the service account, with an
   audience Google fixes. jsonwebtoken is already here and already used to
   verify Firebase ID tokens in data-api.ts, so signing one takes no new
   dependency and no Admin SDK — which would be a large runtime import for a
   path that runs once per sign-in.

   Custom claims ride along and reappear in the ID token, which is how `email`
   reaches server/data-api.ts: an account created from a custom token has no
   address of its own, and ownership and the admin list are both read from it. */

const CUSTOM_TOKEN_AUDIENCE =
  "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

function serviceAccount(): { clientEmail: string; privateKey: string } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (raw.trim()) {
    const parsed = safeJson(raw.trim());
    if (parsed?.client_email && parsed?.private_key) {
      return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  // Environment panels store the key with literal \n, since a real newline
  // cannot survive a single-line value. Both spellings have to work.
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (clientEmail && privateKey) return { clientEmail, privateKey };

  // Local development: the same service-account.json the migration scripts
  // already use. It is gitignored and absent on a deployment, which is why the
  // environment variables above are tried first and this is only a fallback.
  try {
    const file = path.resolve(process.cwd(), "service-account.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (parsed?.client_email && parsed?.private_key) {
      return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
    }
  } catch {
    /* not there — fall through to the error below, which says what to set */
  }

  throw new SsoError(
    "No Firebase service account configured. Set FIREBASE_SERVICE_ACCOUNT to the " +
      "service-account JSON, or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    "not_configured",
  );
}

export function mintCustomToken(uid: string, claims: Record<string, any>): string {
  const { clientEmail, privateKey } = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: clientEmail,
      sub: clientEmail,
      aud: CUSTOM_TOKEN_AUDIENCE,
      iat: now,
      // Google's ceiling for a custom token. The browser spends it the moment
      // it lands, so its real life is a second or two.
      exp: now + 3600,
      uid,
      claims,
    },
    privateKey,
    { algorithm: "RS256" },
  );
}

/* ── The whole handoff, once ──────────────────────────────────────────── */

export type Handoff = {
  customToken: string;
  uid: string;
  name: string;
  email: string;
  sub: string;
  isNew: boolean;
};

export async function completeHandoff(
  ticket: string,
  driver: DbDriver | null,
  opts: { verify?: (t: string) => Promise<TicketClaims> } = {},
): Promise<Handoff> {
  const claims = await (opts.verify ? opts.verify(ticket) : verifyTicket(ticket));

  // Claimed before anything else is done with it, so a replay cannot even
  // reach the writes below.
  await claimTicket(driver, claims);

  const identity = await fetchUserinfo(claims.sub).catch((err) => {
    console.warn(`[sso] /userinfo lookup failed: ${err?.message || err}`);
    return null;
  });
  if (identity && identity.active === false) {
    throw new SsoError(
      `Commun reports this account as disabled (sub ${claims.sub}). Ask the school administrator to re-enable it.`,
      "account_disabled",
    );
  }

  const resolved = await resolveUser(driver, claims, identity);
  const name = displayName(identity?.name ?? claims.name);
  const email = String(identity?.email ?? claims.email ?? "").trim();

  await recordUser(driver, resolved, claims, identity, name);

  const customToken = mintCustomToken(resolved.uid, {
    email,
    name,
    commun_sub: String(claims.sub),
    commun_school_id: claims.school_id ?? null,
    sso: "commun",
  });

  return { customToken, uid: resolved.uid, name, email, sub: String(claims.sub), isNew: resolved.isNew };
}

/* ── The callback route ───────────────────────────────────────────────────
   Registered with Commun as the one URL it may redirect to. It answers with a
   redirect either way: the browser is mid-sign-in and belongs in the app, not
   on an error page it has to navigate away from itself.

   The custom token travels in the URL fragment, not the query string. A
   fragment is never sent to a server and never written to an access log, and
   the client strips it the moment it is spent. */

export function ssoCallbackHandler(driver: DbDriver | null) {
  return async (req: Request, res: Response) => {
    const ticket = typeof req.query?.ticket === "string" ? req.query.ticket : "";

    // Written by hand rather than through res.redirect, because this same
    // handler is driven by Express here and by Vercel's response object in
    // api/auth/callback.ts. Both are http.ServerResponse underneath, so this
    // works on either; res.redirect is a helper only one of them promises.
    const go = (url: string) => {
      res.statusCode = 302;
      res.setHeader("Location", url);
      res.end();
    };

    const fail = (reason: string, detail?: string) => {
      console.warn(`[sso] handoff failed: ${detail || reason}`);
      go(`/?sso_error=${encodeURIComponent(reason)}`);
    };

    if (!ticket) return fail("missing_ticket", "no ticket query parameter");

    try {
      const result = await completeHandoff(ticket, driver);
      console.log(
        `[sso] ${result.isNew ? "provisioned" : "matched"} ${result.name} <${result.email || "no address"}> ` +
          `sub=${result.sub} uid=${result.uid}`,
      );
      go(`/#sso_token=${encodeURIComponent(result.customToken)}`);
    } catch (err: any) {
      // The code travels to the browser, the message only to the log — it can
      // name tables and keys. Reading the reason off the error beats matching
      // its wording, which is how "the guard table is missing" spent a
      // deployment disguised as "verification failed".
      fail(err instanceof SsoError ? err.reason : "verification_failed",
           err?.message || String(err));
    }
  };
}

/** Mounts the callback on the dev Express server. Vercel serves the same
 *  handler from api/auth/callback.ts, so the two cannot drift. */
export function mountCommunSso(app: Express) {
  const { driver, why } = createDriver();
  const { clientId, machineToken, schoolUrl } = cfg();
  console.log(
    `[sso] Commun SSO ready — school ${schoolUrl}, client ${clientId || "NOT SET"}, ` +
      `machine token ${machineToken ? "set" : "NOT SET"}, replay guard: ${why}.`,
  );

  app.get("/auth/callback", ssoCallbackHandler(driver));
  app.get("/api/sso/status", async (_req, res) => res.json(await ssoStatus()));
}

/* ── Is this wired up? ────────────────────────────────────────────────────
   Answers what is configured and whether Commun's keys can actually be
   reached, without signing anyone in. Nothing secret is returned — only
   whether each piece is present — so it is safe to leave reachable, and it
   turns "SSO doesn't work" into one request that names the missing part. */

export async function ssoStatus(): Promise<Record<string, any>> {
  const { schoolUrl, clientId, machineToken } = cfg();
  const { driver, why } = createDriver();

  let jwks: string;
  try {
    jwks = (await fetchJwks()).map((k) => k.kid).join(", ");
  } catch (err: any) {
    jwks = `unreachable: ${err?.message || err}`;
  }

  let serviceAccountState: string;
  try {
    serviceAccount();
    serviceAccountState = "set";
  } catch {
    serviceAccountState = "missing";
  }

  // Whether the guard's storage is actually THERE, not just configured. A
  // missing table looks identical to a healthy one until a teacher tries to
  // sign in, which is a bad moment to find out.
  let guardTable = "no database configured";
  if (driver) {
    try {
      await driver.get("sso_used_tickets", "jti", "__status_probe__");
      guardTable = "ready";
    } catch (err: any) {
      guardTable = `MISSING — run supabase/sso.sql (${err?.message || err})`;
    }
  }

  return {
    school_url: schoolUrl,
    client_id: clientId || null,
    callback_url: process.env.COMMUN_SSO_CALLBACK_URL || null,
    machine_token: machineToken ? "set" : "missing",
    service_account: serviceAccountState,
    replay_guard: driver ? why : "in-memory — development only, NOT safe in production",
    replay_guard_table: guardTable,
    jwks_kids: jwks,
  };
}
