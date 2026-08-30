#!/usr/bin/env bash
# Prod container içinde: DATABASE_URL zaten env'de.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> DB patch (migrate.ts deploy'da da koşar)"
bun -e "
import postgres from 'postgres';
import { applyDbPatches } from './src/lib/server/db-patches.ts';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL yok');
const sql = postgres(url, { max: 1 });
await applyDbPatches(sql);
await sql.end();
console.log('Patch OK');
"

echo "==> Marka seed"
bun scripts/seed-bilisim-brands-bulk.mjs

echo "==> Logo düzeltme (bilisim + telekom)"
bun scripts/fix-brand-logos.mjs

echo "==> Cevap temizliği (bovbet/kazansana/bahsine hariç; bilisim+telekom tamamen)"
bun scripts/clear-synthetic-responses.mjs

echo "Bitti."
