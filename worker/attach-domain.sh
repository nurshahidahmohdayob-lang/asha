#!/usr/bin/env bash
# Attach a custom domain to the zworksheets worker so published links become
# https://<domain>/<code>. The domain must already be registered AND added to
# the Cloudflare account that owns the worker (a "zone" must exist for it).
#
# Usage:  bash attach-domain.sh zedu.my
set -euo pipefail

DOMAIN="${1:-}"
ACCOUNT_ID="b0bc1ca11b486fa358208e029dbfc2fb"
WORKER="zworksheets"
CFG="$HOME/Library/Preferences/.wrangler/config/default.toml"

if [ -z "$DOMAIN" ]; then echo "Usage: bash attach-domain.sh <domain>  (e.g. zedu.my)"; exit 1; fi
TOKEN=$(grep -m1 -E 'oauth_token' "$CFG" 2>/dev/null | sed -E 's/.*=[[:space:]]*"?([^"]+)"?.*/\1/')
if [ -z "$TOKEN" ]; then echo "Not logged in — run: npx wrangler login"; exit 1; fi

api() { curl -s -m 20 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }

echo "→ Looking up zone for $DOMAIN ..."
ZONE_ID=$(api "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
  | python3 -c 'import sys,json;r=json.load(sys.stdin).get("result") or [];print(r[0]["id"] if r else "")')

if [ -z "$ZONE_ID" ]; then
  echo "✗ No Cloudflare zone found for '$DOMAIN'."
  echo "  First register it and add it to this account (Dashboard → Add a domain),"
  echo "  then re-run this script."
  exit 1
fi
echo "  zone id: $ZONE_ID"

echo "→ Attaching $DOMAIN to the $WORKER worker ..."
RESP=$(api -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/domains" \
  --data "{\"environment\":\"production\",\"hostname\":\"$DOMAIN\",\"service\":\"$WORKER\",\"zone_id\":\"$ZONE_ID\"}")

echo "$RESP" | python3 -c '
import sys,json
d=json.load(sys.stdin)
if d.get("success"):
    print("✓ Custom domain attached. Cloudflare is issuing the SSL cert (a few minutes).")
else:
    print("✗ Failed:", json.dumps(d.get("errors"), indent=2))
'
echo
echo "Next: open https://$DOMAIN — when it shows the host text, set it in the app:"
echo "  HTML Host → Link domain (advanced) → https://$DOMAIN → Save & test domain"
