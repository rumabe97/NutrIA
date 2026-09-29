-- Hand-added comment only; the statements are drizzle-kit's, unchanged (decision 0071, project 008 phase 2).
-- The column is nullable with no default: metadata only, no row is rewritten. Every existing row
-- holds NULL, which always passes the foreign key, so correctness does not rest on the table's size.
-- Not CONCURRENTLY and not NOT VALID: drizzle's migrator runs every pending migration inside one
-- transaction, where Postgres refuses CREATE INDEX CONCURRENTLY. The foreign key takes SHARE ROW
-- EXCLUSIVE on "user" for as long as it scans audit_logs, which is empty in production on
-- 2026-09-29: sign-in reads go on, and sign-up, profile edits and deletions wait milliseconds.
-- Both index builds take SHARE on audit_logs only, a table that grows by admin actions.
-- Once audit_logs holds hundreds of thousands of rows, a new foreign key there goes NOT VALID plus
-- VALIDATE CONSTRAINT, and a new index needs its own path, decided with the owner.
ALTER TABLE "audit_logs" ADD COLUMN "subject_user_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_subject_idx" ON "audit_logs" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");