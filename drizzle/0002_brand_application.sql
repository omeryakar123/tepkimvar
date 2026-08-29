-- Marka başvuru formu ek alanları
ALTER TABLE "brand_verification_requests"
  ADD COLUMN IF NOT EXISTS "telegram" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "photo_url" text,
  ADD COLUMN IF NOT EXISTS "request_type" text NOT NULL DEFAULT 'verification';
