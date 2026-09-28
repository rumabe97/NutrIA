-- Hand-added comment only; the statements are drizzle-kit's, unchanged (decision 0068, project 007 phase 3).
-- Not CONCURRENTLY: drizzle's migrator runs every pending migration inside one transaction
-- (drizzle-orm pg-core dialect.migrate → session.transaction), and Postgres refuses
-- CREATE INDEX CONCURRENTLY there. A plain build takes a SHARE lock on each table: reads go on,
-- and writes (inserts, updates, deletes) wait until both builds commit. On the dev branch,
-- 2026-09-28: analytics_events 1,143 rows, plan_generation_jobs 86 — a build of milliseconds.
-- At hundreds of thousands of rows this migration cannot ship as written: such an index needs its
-- own path, decided with the owner — not a hand-built index, which would make this file fail.
CREATE INDEX CONCURRENTLY there. A plain build holds a SHARE lock on each table while it runs —
-- reads go on, inserts wait. On the dev branch, 2026-09-28: analytics_events 1,143 rows,
-- plan_generation_jobs 86 — a build of milliseconds. At hundreds of thousands of rows, build these
-- two indexes by hand with CONCURRENTLY before deploying instead (as 0040 notes for its own).
CREATE INDEX "plan_generation_jobs_created_at_idx" ON "plan_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_event_created_at_idx" ON "analytics_events" USING btree ("event","created_at");
