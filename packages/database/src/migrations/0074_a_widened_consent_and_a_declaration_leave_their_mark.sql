-- Cannot be dropped: removing an enum value means rebuilding the type (packages/database/AGENTS.md § Migrations).
-- Cannot be used in the same run: drizzle applies pending files in one transaction (0073 with this one), so nothing here or in a migration applied alongside may write the new value; the two columns are nullable, with no default and no backfill.
ALTER TYPE "public"."care_link_ended_by" ADD VALUE 'declared';--> statement-breakpoint
ALTER TABLE "care_links" ADD COLUMN "scope_consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "care_links" ADD COLUMN "scope_consent_version" text;