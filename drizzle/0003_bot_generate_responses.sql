ALTER TABLE "brand_bot_configs"
  ADD COLUMN IF NOT EXISTS "generate_responses" boolean DEFAULT true NOT NULL;
