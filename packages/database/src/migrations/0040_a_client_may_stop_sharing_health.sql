ALTER TYPE "public"."care_access_action" ADD VALUE 'granted';--> statement-breakpoint
ALTER TYPE "public"."care_access_action" ADD VALUE 'withdrawn';--> statement-breakpoint
ALTER TABLE "care_access_log" ADD COLUMN "link_id" uuid;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "agreement_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "agreement_version" text;--> statement-breakpoint
ALTER TABLE "care_access_log" ADD CONSTRAINT "care_access_log_link_id_care_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."care_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Not CONCURRENTLY: the migrator runs in one transaction, and the table is near empty while the professional switch is off. At hundreds of thousands of rows, build indexes here outside the migrator.
CREATE INDEX "care_access_log_link_id_idx" ON "care_access_log" USING btree ("link_id");--> statement-breakpoint
--
-- Hand-added: fills `link_id` on the trail rows written before the column
-- existed, where the link can be told unambiguously — the client (`user_id`)
-- and the professional (`professional_id`) have exactly one link between them,
-- whatever its status. Two links between the same pair, or a professional
-- already set null, and there is no way to say which: the row stays null, as
-- the column allows. Nothing is deleted or overwritten — only nulls are filled,
-- and only with the one link that pair ever had.
UPDATE "care_access_log" AS "entry"
SET "link_id" = (
  SELECT "link"."id" FROM "care_links" AS "link"
  WHERE "link"."client_id" = "entry"."user_id" AND "link"."professional_id" = "entry"."professional_id"
)
WHERE "entry"."link_id" IS NULL
  AND "entry"."professional_id" IS NOT NULL
  AND (
    SELECT count(*) FROM "care_links" AS "link"
    WHERE "link"."client_id" = "entry"."user_id" AND "link"."professional_id" = "entry"."professional_id"
  ) = 1;
