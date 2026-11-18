-- Anyone can open a practice: the stores of project 025 (`0111`), nothing yet able to reach them.
--
-- Additive. Five new types and four new tables, created empty except for the
-- backfill at the end; two nullable or defaulted columns on existing tables;
-- one `DROP NOT NULL`, which is catalog-only and loosens nothing a row could
-- violate. No row is changed or deleted; no statement here matches the
-- migration guard's destructive list, so this file carries no
-- `reviewed-destructive` line.
--
-- What each does to the rows already there:
-- - `professionals.collegiate_number` DROP NOT NULL: nothing; every row keeps
--   its number, and the API still running writes one on every grant.
-- - `care_links.consent_scope`: every existing link reads `full` through the
--   column's constant default (PG 11+: no rewrite). That is the backfill of
--   `0111` § 4 — they consented to 004's list, which is the badged one.
-- - `meal_plans.care_link_id`: null on every plan. Adding the foreign key
--   validates it against a column that is all null. Its index is built here,
--   a plain CREATE INDEX under the file's lock, because the table is small
--   now and CONCURRENTLY cannot run inside drizzle's one transaction later
--   (migration-reviewer): without it, every link deleted with an account
--   scans meal_plans for its `set null`.
-- - `professional_badge_checks`: one `pass` per existing `professionals` row,
--   the hand-added step at the end.
--
-- The API still running during the deploy declares none of the new columns
-- and reads none of the new tables, so Drizzle's SELECT/RETURNING lists are
-- unchanged for it.
CREATE TYPE "public"."badge_channel" AS ENUM('register_email', 'post', 'phone');--> statement-breakpoint
CREATE TYPE "public"."badge_check_kind" AS ENUM('applied', 'pass', 'fail', 'withdrawn', 'lapsed');--> statement-breakpoint
CREATE TYPE "public"."care_consent_scope" AS ENUM('full', 'plan');--> statement-breakpoint
CREATE TYPE "public"."practice_restriction_kind" AS ENUM('suspended', 'closing', 'lifted');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('consultation', 'month', 'plan');--> statement-breakpoint
CREATE TABLE "practice_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"acted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acted_by" text,
	"effective_at" timestamp with time zone,
	"kind" "practice_restriction_kind" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_restrictions_closing_has_date" CHECK ("practice_restrictions"."kind" <> 'closing' or "practice_restrictions"."effective_at" is not null),
	CONSTRAINT "practice_restrictions_has_reason" CHECK ("practice_restrictions"."kind" = 'lifted' or "practice_restrictions"."reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "professional_badge_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel" "badge_channel",
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_by" text,
	"due_at" timestamp with time zone,
	"kind" "badge_check_kind" NOT NULL,
	"number" text,
	"reason" text,
	"register" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_badge_checks_applied_declares" CHECK ("professional_badge_checks"."kind" <> 'applied' or ("professional_badge_checks"."register" is not null and "professional_badge_checks"."number" is not null)),
	CONSTRAINT "professional_badge_checks_pass_is_due" CHECK ("professional_badge_checks"."kind" <> 'pass' or "professional_badge_checks"."due_at" is not null),
	CONSTRAINT "professional_badge_checks_removal_has_reason" CHECK ("professional_badge_checks"."kind" not in ('fail', 'withdrawn', 'lapsed') or "professional_badge_checks"."reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "professional_badge_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"channel" "badge_channel" NOT NULL,
	"check_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_reason" text,
	"hours" jsonb,
	"price_cents" integer,
	"price_unit" "price_unit",
	"queued_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"seen_by" text,
	"studies" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_profiles_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "professional_profiles_studies_length" CHECK (char_length("professional_profiles"."studies") <= 2000),
	CONSTRAINT "professional_profiles_price_not_negative" CHECK ("professional_profiles"."price_cents" >= 0),
	CONSTRAINT "professional_profiles_hidden_has_reason" CHECK ("professional_profiles"."hidden_at" is null or "professional_profiles"."hidden_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "professionals" ALTER COLUMN "collegiate_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "care_links" ADD COLUMN "consent_scope" "care_consent_scope" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD COLUMN "care_link_id" uuid;--> statement-breakpoint
ALTER TABLE "practice_restrictions" ADD CONSTRAINT "practice_restrictions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "practice_restrictions" ADD CONSTRAINT "practice_restrictions_acted_by_user_id_fk" FOREIGN KEY ("acted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "professional_badge_checks" ADD CONSTRAINT "professional_badge_checks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "professional_badge_checks" ADD CONSTRAINT "professional_badge_checks_checked_by_user_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "professional_badge_codes" ADD CONSTRAINT "professional_badge_codes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "professional_badge_codes" ADD CONSTRAINT "professional_badge_codes_check_id_professional_badge_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."professional_badge_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_seen_by_user_id_fk" FOREIGN KEY ("seen_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "practice_restrictions_user_id_idx" ON "practice_restrictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "professional_badge_checks_user_id_idx" ON "professional_badge_checks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "professional_badge_codes_user_id_idx" ON "professional_badge_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "professional_badge_codes_check_id_idx" ON "professional_badge_codes" USING btree ("check_id");--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_care_link_id_care_links_id_fk" FOREIGN KEY ("care_link_id") REFERENCES "public"."care_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plans_care_link_id_idx" ON "meal_plans" USING btree ("care_link_id");--> statement-breakpoint
-- Hand-added data step, the exception `packages/database/AGENTS.md` sanctions
-- (the shape of `0007`'s and `0061`'s): drizzle-kit emits DDL and never the
-- data move.
--
-- Every grant project 004 made keeps its badge and enters the re-check list
-- (PRD 025 scope 6, decided by the owner on 2026-11-18): one `pass` per
-- `professionals` row, checked when and by whom it was granted, with the number
-- it was granted with. No channel (the owner checked it before any channel
-- existed), so the reason says where it came from. Due 30 days after this runs
-- — `now()` is the deploy's transaction time — so the re-check falls due within
-- 30 days of the release (PRD 025 criterion 4) and the badge lapses 30 days
-- after that if nobody re-checks it.
--
-- Safe on the rows already there: it reads `professionals` and writes only to
-- the table created above, which is empty until now. Every `pass` row satisfies
-- `professional_badge_checks_pass_is_due`. `granted_by` may be null (the
-- granting account gone), which `checked_by` accepts. Run twice, it would write
-- a second identical `pass` per practitioner, which derives the same badge; it
-- runs once, as every migration does.
INSERT INTO "professional_badge_checks" ("user_id", "kind", "checked_at", "checked_by", "number", "channel", "reason", "due_at")
SELECT "user_id", 'pass', "granted_at", "granted_by", "collegiate_number", NULL, 'project 004 grant', now() + interval '30 days'
FROM "professionals";
