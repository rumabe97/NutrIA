ALTER TABLE "plan_generation_jobs" ADD COLUMN "start_date" date;--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plans_one_scheduled_per_user" ON "meal_plans" USING btree ("user_id") WHERE "meal_plans"."status" = 'scheduled';
-- No row is scheduled before this release writes one, so the index cannot fail on rows already there; not CONCURRENTLY, because the migrator runs in one transaction. The previous API never reads start_date, which is nullable.
