#!/usr/bin/env bun
/**
 * bovbet/kazansana hariç tüm şikayetlerde marka cevabını kaldırır.
 *   bun scripts/clear-synthetic-responses.mjs
 */
import postgres from "postgres";

const KEEP = ["bovbet", "kazansana"];
const sql = postgres(process.env.DATABASE_URL!, { max: 3 });
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const deleted = await sql`
  DELETE FROM complaint_replies cr
  USING complaints c, brands b
  WHERE cr.complaint_id = c.id
    AND b.id = c.brand_id
    AND b.slug NOT IN ${sql(KEEP)}
    AND cr.is_brand = true
`;

const updated = await sql`
  UPDATE complaints c
  SET brand_response = NULL,
      brand_response_at = NULL,
      brand_response_by = NULL,
      first_response_at = NULL,
      first_response_minutes = NULL,
      status = CASE WHEN c.status = 'answered' THEN 'approved' ELSE c.status END,
      bot_error = NULL,
      updated_at = NOW()
  FROM brands b
  WHERE c.brand_id = b.id
    AND b.slug NOT IN ${sql(KEEP)}
    AND (c.brand_response IS NOT NULL OR c.status = 'answered')
`;

console.log(`Silinen marka yanıtı: ${deleted.count}, güncellenen şikayet: ${updated.count}`);
await sql.end();
