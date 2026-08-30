#!/usr/bin/env bun
/**
 * Marka yanıtlarını temizler:
 * - bilisim-teknoloji + telekomunikasyon: TÜM marka yanıtları silinir
 * - Diğer kategoriler: yalnızca bovbet, kazansana, bahsine yanıtları kalır
 *
 *   bun scripts/clear-synthetic-responses.mjs
 */
import postgres from "postgres";

const KEEP = ["bovbet", "kazansana", "bahsine"];
const STRIP_CATEGORIES = ["bilisim-teknoloji", "telekomunikasyon"];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 3 });

const matchWhere = sql`
  EXISTS (
    SELECT 1
    FROM complaints c
    JOIN brands b ON b.id = c.brand_id
    LEFT JOIN categories cat ON cat.id = b.category_id
    LEFT JOIN categories ccat ON ccat.id = c.category_id
    WHERE c.id = cr.complaint_id
      AND (
        COALESCE(cat.slug, ccat.slug) IN ${sql(STRIP_CATEGORIES)}
        OR b.slug NOT IN ${sql(KEEP)}
      )
  )
`;

const deleted = await sql`
  DELETE FROM complaint_replies cr
  WHERE cr.is_brand = true
    AND ${matchWhere}
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
  LEFT JOIN categories cat ON cat.id = b.category_id
  WHERE c.brand_id = b.id
    AND (
      cat.slug IN ${sql(STRIP_CATEGORIES)}
      OR b.slug NOT IN ${sql(KEEP)}
      OR EXISTS (
        SELECT 1 FROM categories ccat
        WHERE ccat.id = c.category_id AND ccat.slug IN ${sql(STRIP_CATEGORIES)}
      )
    )
    AND (c.brand_response IS NOT NULL OR c.status = 'answered')
`;

console.log(
  `Silinen marka yanıtı (reply): ${deleted.count}, güncellenen şikayet: ${updated.count}`,
);
await sql.end();
