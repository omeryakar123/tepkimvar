#!/usr/bin/env bash
# Prod'da (Coolify app container veya SSH) DATABASE_URL zaten env'de olmalı.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Migration: generate_responses kolonu"
python3 - <<'PY'
import os, psycopg2
url = os.environ.get("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL tanımlı değil")
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(
    "ALTER TABLE brand_bot_configs ADD COLUMN IF NOT EXISTS generate_responses boolean DEFAULT true NOT NULL"
)
conn.commit()
cur.close()
conn.close()
print("OK")
PY

echo "==> Markaları bilisim-teknoloji kategorisine ekle"
python3 scripts/seed-bilisim-brands-bulk.py

echo "==> Bot cevaplarını temizle (bovbet/kazansana/bahsine hariç)"
python3 scripts/clear-synthetic-responses.py

echo "==> Logoları düzelt"
python3 scripts/fix-tech-category-logos.py

echo "Bitti."
