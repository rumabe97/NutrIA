DROP INDEX "meal_plans_one_pending_review_per_user";--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plans_one_pending_review_per_user" ON "meal_plans" USING btree ("user_id") WHERE "meal_plans"."status" = 'pending_review';--> statement-breakpoint
ALTER TYPE "public"."plan_status" ADD VALUE 'scheduled';
