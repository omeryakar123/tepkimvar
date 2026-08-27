-- AI Complaint & Review Bot
--
-- Bu dosya ELLE yazıldı (drizzle-kit'in çalıştırılabildiği bir ortam yoktu) ve
-- bilerek IDEMPOTENT tutuldu: iki kez uygulanması güvenlidir, mevcut veriye
-- dokunmaz. Yeni kolonların tümü DEFAULT'lu olduğu için eski satırlar
-- "insan üretimi / sentetik değil" olarak kalır.
--
-- Uygulama:  npm run db:migrate     (veya psql < drizzle/0001_complaint_bot.sql)

CREATE TABLE IF NOT EXISTS "brand_bot_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"daily_target" integer DEFAULT 3 NOT NULL,
	"min_rating" smallint DEFAULT 1 NOT NULL,
	"max_rating" smallint DEFAULT 5 NOT NULL,
	"rating_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"language" text DEFAULT 'tr' NOT NULL,
	"complaint_tone" text DEFAULT 'natural' NOT NULL,
	"response_tone" text DEFAULT 'professional' NOT NULL,
	"scenarios" text[] DEFAULT '{}'::text[] NOT NULL,
	"custom_instructions" text,
	"similarity_threshold" numeric(3, 2) DEFAULT '0.82' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_bot_configs_brand_id_unique" UNIQUE("brand_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bot_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"trigger" text DEFAULT 'cron' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"target_count" integer DEFAULT 0 NOT NULL,
	"complaints_generated" integer DEFAULT 0 NOT NULL,
	"responses_generated" integer DEFAULT 0 NOT NULL,
	"duplicates_detected" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"triggered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "is_synthetic" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "generated_by" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'tr' NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "bot_scenario" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "bot_run_id" uuid;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "bot_error" text;--> statement-breakpoint

ALTER TABLE "complaint_replies" ADD COLUMN IF NOT EXISTS "language" text;--> statement-breakpoint
ALTER TABLE "complaint_replies" ADD COLUMN IF NOT EXISTS "generated_by" text;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "brand_bot_configs" ADD CONSTRAINT "brand_bot_configs_brand_id_brands_id_fk"
		FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "bot_runs" ADD CONSTRAINT "bot_runs_brand_id_brands_id_fk"
		FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "bot_runs" ADD CONSTRAINT "bot_runs_triggered_by_user_id_fk"
		FOREIGN KEY ("triggered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "complaints" ADD CONSTRAINT "complaints_bot_run_id_bot_runs_id_fk"
		FOREIGN KEY ("bot_run_id") REFERENCES "public"."bot_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Günlük hedef kontrolü (marka + gün) ve panel listeleri bu indeksleri kullanır.
CREATE INDEX IF NOT EXISTS "complaints_brand_created_idx" ON "complaints" ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaints_synthetic_idx" ON "complaints" ("is_synthetic") WHERE "is_synthetic";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bot_runs_brand_started_idx" ON "bot_runs" ("brand_id","started_at" DESC);
