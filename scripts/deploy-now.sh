#!/usr/bin/env bash
# Prod'a hemen deploy tetikler.
# Kullanım: COOLIFY_TOKEN='1|...' ./scripts/deploy-now.sh
set -euo pipefail

TOKEN="${COOLIFY_TOKEN:-}"
APP="${COOLIFY_APP_UUID:-xqqcmqdtdbpqcieqafypp28o}"
BASE="${COOLIFY_URL:-http://131.123.39.95:8000}"
BASE="${BASE%/}/api/v1"

if [ -z "$TOKEN" ]; then
  echo "COOLIFY_TOKEN tanımlı değil."
  echo "Coolify → Keys & Tokens → deploy yetkili token oluşturun, sonra:"
  echo "  COOLIFY_TOKEN='1|...' ./scripts/deploy-now.sh"
  exit 1
fi

echo "Uygulama: $APP"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/applications/$APP" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Durum:', d.get('status','?'), '| branch:', d.get('git_branch','?'))" 2>/dev/null || true

echo "Deploy tetikleniyor..."
HTTP=$(curl -sS -o /tmp/coolify-deploy.out -w "%{http_code}" -X POST "$BASE/deploy" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"uuid\":\"$APP\",\"force\":true}")

cat /tmp/coolify-deploy.out
echo ""
echo "HTTP $HTTP"

if [ "$HTTP" = "200" ] || [ "$HTTP" = "201" ]; then
  echo "OK — Coolify build bitince https://tepkimvar.com yenilenecek (2–5 dk)."
else
  echo "Hata — token yetkisi veya süresi kontrol edin."
  exit 1
fi
