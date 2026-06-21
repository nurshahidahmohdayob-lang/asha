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

## Endpoints

- `POST /upload` with `{ "html": "<!doctype html>…", "code": "optional-word" }`
  → returns `{ "code": "ab12", "url": "https://…/s/ab12" }`
- `GET /s/<code>` → the worksheet HTML

Published worksheets are kept for 120 days.
