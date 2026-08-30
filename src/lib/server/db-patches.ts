/**
 * Eksik DB kolonlarını idempotent ekler (drizzle journal dışı migration'lar).
 */
import postgres from "postgres";

const PATCHES = [
  `ALTER TABLE brand_bot_configs ADD COLUMN IF NOT EXISTS generate_responses boolean DEFAULT true NOT NULL`,
  `ALTER TABLE brand_verification_requests ADD COLUMN IF NOT EXISTS address text`,
  `ALTER TABLE brand_verification_requests ADD COLUMN IF NOT EXISTS photo_url text`,
  `ALTER TABLE brand_verification_requests ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'verification'`,
  `ALTER TABLE complaints ADD COLUMN IF NOT EXISTS platform_username text`,
  `CREATE TABLE IF NOT EXISTS page_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path text NOT NULL,
    referrer text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON page_views (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS page_views_path_idx ON page_views (path)`,
  `CREATE TABLE IF NOT EXISTS complaint_supports (
    complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (complaint_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS complaints_votes_idx ON complaints (votes DESC)`,
];

export async function applyDbPatches(sql: postgres.Sql): Promise<string[]> {
  const done: string[] = [];
  for (const stmt of PATCHES) {
    await sql.unsafe(stmt);
    done.push(stmt.slice(0, 55));
  }
  return done;
}
