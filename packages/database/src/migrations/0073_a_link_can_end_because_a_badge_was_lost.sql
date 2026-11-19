-- Cannot be dropped: removing an enum value means rebuilding the type (packages/database/AGENTS.md § Migrations).
-- Cannot be used in the same run: drizzle applies pending files in one transaction, so a later migration writing 'badge_lost' alongside this one fails with 55P04.
ALTER TYPE "public"."care_link_ended_by" ADD VALUE 'badge_lost';