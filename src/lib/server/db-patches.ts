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
  `CREATE TABLE IF NOT EXISTS brand_follows (
    user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, brand_id)
  )`,
  `CREATE INDEX IF NOT EXISTS brand_follows_brand_id_idx ON brand_follows (brand_id)`,
  `CREATE INDEX IF NOT EXISTS brand_follows_user_id_idx ON brand_follows (user_id)`,
  `CREATE TABLE IF NOT EXISTS phone_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    ip_address text,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS phone_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    phone text NOT NULL,
    verified_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS phone_otps_phone_created_idx ON phone_otps (phone, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS phone_verifications_user_phone_idx ON phone_verifications (user_id, phone)`,
];

export async function applyDbPatches(sql: postgres.Sql): Promise<string[]> {
  const done: string[] = [];
  for (const stmt of PATCHES) {
    await sql.unsafe(stmt);
    done.push(stmt.slice(0, 55));
  }
  return done;
}
