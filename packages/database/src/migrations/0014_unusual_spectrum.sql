ALTER TABLE "user" ADD COLUMN "activated_at" timestamp with time zone;
--> statement-breakpoint
-- Everyone already let in stays let in: until now `email_verified` *was* the
-- door, so every account carrying it was one the owner had opened by hand.
UPDATE "user" SET "activated_at" = now() WHERE "email_verified" AND "activated_at" IS NULL;
