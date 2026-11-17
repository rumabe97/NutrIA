-- An answer withheld for stating how much of a vitamin or a mineral to take has a code of its own (`0108`).
--
-- reviewed-destructive: no row is read, moved or deleted — the check on
-- `ai_messages.decline` is dropped and added back one value wider. Between the
-- two statements nothing invalid can arrive: the API still running writes only
-- the five old values. What is given up is the way back: once a
-- `supplement_amount` row exists, the narrower check cannot be re-added without
-- first clearing those rows (migration-reviewer, 2026-11-16).
ALTER TABLE "ai_messages" DROP CONSTRAINT "ai_messages_decline";--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_decline" CHECK ("ai_messages"."decline" is null or "ai_messages"."decline" in ('acting', 'allergen', 'clinical', 'invented_figure', 'off_topic', 'supplement_amount'));