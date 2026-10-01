ALTER TYPE "public"."plan_status" ADD VALUE 'scheduled';--> statement-breakpoint
DROP INDEX "meal_plans_one_pending_review_per_user";--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plans_one_pending_review_per_user" ON "meal_plans" USING btree ("user_id") WHERE "meal_plans"."status" = 'pending_review';
-- Same rows as the old NOT IN (status is NOT NULL, 7 values); one migrator transaction holds the lock from the DROP to the commit, so there is no window and the CREATE cannot fail on existing rows.
