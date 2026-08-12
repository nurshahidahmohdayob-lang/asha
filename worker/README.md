# Zera worksheet host (Cloudflare Worker)

Publishes a worksheet's HTML and serves it at a short public link
(`https://zworksheets.<your-subdomain>.workers.dev/s/<code>`) so students on any
device can open it.

## One-time deploy

Run these from this folder (`worker/`):

```bash
cd worker

# 1. Log in to your Cloudflare account (opens a browser to authorise)
npx wrangler login

# 2. Create the KV store and copy the printed "id"
npx wrangler kv namespace create WORKSHEETS

# 3. Paste that id into wrangler.toml -> [[kv_namespaces]] id = "..."

# 4. Deploy. It prints your worker URL, e.g.
#    https://zworksheets.your-name.workers.dev
npx wrangler deploy
```

Then give that worker URL to the app (it's wired into the “Publish” button).

## The live host — `zera-4ag.pages.dev`

This is what the app actually talks to. It's the Pages version in `pages/`,
serving the same KV store. Deploy it after any change to
`pages/public/_worker.js`:

The Pages project is called **`zera`**; its subdomain is `zera-4ag.pages.dev`
(Cloudflare added the suffix). It lives in the account
`b0bc1ca11b486fa358208e029dbfc2fb` — Nurshahidahmohdayob@gmail.com's.

```bash
cd worker/pages

CLOUDFLARE_API_TOKEN=$(grep -m1 '^CF_PAGES_TOKEN=' ../../.env | cut -d= -f2-) \
CLOUDFLARE_ACCOUNT_ID=b0bc1ca11b486fa358208e029dbfc2fb \
npx wrangler pages deploy public --project-name zera --branch main --commit-dirty=true
```

Two gotchas that cost time once already:

- Run it from `worker/pages`, not the repo root. Wrangler auto-loads the root
  `.env`, whose `CLOUDFLARE_API_TOKEN` is a *different* token — IP-restricted
  and with no Pages permission, so it fails with `code: 9109`. That token is
  used at runtime for Workers AI image generation; don't repurpose it.
  `CF_PAGES_TOKEN` is the deploy one.
- `wrangler login` is a poor fallback here — it's easy to authorise the wrong
  Cloudflare account, and an account without this project deploys a *new*
  empty one on a different URL, orphaning every worksheet link already shared.

## Endpoints

- `POST /upload` with `{ "html": "<!doctype html>…", "code": "optional-word" }`
  → returns `{ "code": "ab12", "url": "https://…/s/ab12" }`
- `GET /s/<code>` → the worksheet HTML
- `POST /file` — multipart form data, field `file` (max 20 MB)
  → returns `{ "code": "…", "name": "handout.pdf", "size": 12345, "url": "https://…/f/…" }`
- `GET /f/<code>` → that file, served with its own content type

Published worksheets are kept for 120 days; uploaded files for a year.
