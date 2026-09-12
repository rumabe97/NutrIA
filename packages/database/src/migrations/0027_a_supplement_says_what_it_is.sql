CREATE TYPE "public"."supplement_kind" AS ENUM('protein', 'creatine', 'vitamins_minerals', 'omega_3', 'other');--> statement-breakpoint
ALTER TABLE "supplements" ADD COLUMN "kind" "supplement_kind" DEFAULT 'other' NOT NULL;--> statement-breakpoint
-- Hand-added data step (`0052`): the generated statements above give every
-- existing supplement the kind `other`. One recorded with protein grams was
-- recorded as a protein supplement — that was the only kind the old form could
-- express — so it becomes one, keeps its grams, and keeps protein powder in its
-- owner's dishes. The rest have no protein to keep.
UPDATE "supplements" SET "kind" = 'protein' WHERE "protein_g_per_serving" > 0;