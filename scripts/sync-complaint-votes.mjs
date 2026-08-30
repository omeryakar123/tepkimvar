#!/usr/bin/env bun
/** Sahte seed votes değerlerini temizler — yalnızca gerçek complaint_supports sayısını yazar. */
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const [{ n }] = await sql`
  WITH synced AS (
    UPDATE complaints c
    SET votes = COALESCE((
      SELECT count(*)::int FROM complaint_supports s WHERE s.complaint_id = c.id
    ), 0)
    RETURNING 1
  )
  SELECT count(*)::int AS n FROM synced
`;

console.log(`Destek sayacı senkronize edildi: ${n} şikayet`);
await sql.end();
