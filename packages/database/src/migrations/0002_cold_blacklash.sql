DROP INDEX "onboarding_state_user_id_idx";--> statement-breakpoint
DROP INDEX "profiles_user_id_idx";--> statement-breakpoint
DROP INDEX "user_preferences_user_id_idx";--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_user_id_key" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_key" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE("user_id");