-- Hand-added data step, the exception `packages/database/AGENTS.md` sanctions: a
-- custom migration (`generate --custom`), no schema change, so its snapshot is a
-- copy of 0071's.
--
-- Project 025 phase 3, step 0 (a), from phase 2's review: `0071` gave every
-- project 004 grant a `pass` as it ran, but the owner's grant route kept granting
-- between that deploy and this phase without writing one. Every `professionals`
-- row that still has **no** badge check at all gets the same `pass` `0071` wrote:
-- checked when and by whom it was granted, with the number it was granted with,
-- no channel, the reason saying where it came from, due 30 days after this runs
-- (PRD 025 criterion 4), so it lapses 30 days after that if nobody re-checks it.
-- From this phase on the grant route writes its own `pass` in the grant's
-- transaction, so nothing new can fall in the gap.
--
-- Safe on the rows already there: it reads `professionals` and only inserts into
-- `professional_badge_checks`. Idempotent by `NOT EXISTS`: an account with any
-- check — `0071`'s, an application, anything — is left alone, so a second run
-- writes nothing. Every row satisfies `professional_badge_checks_pass_is_due`;
-- `granted_by` may be null (the granting account gone), which `checked_by` takes.
INSERT INTO "professional_badge_checks" ("user_id", "kind", "checked_at", "checked_by", "number", "channel", "reason", "due_at")
SELECT p."user_id", 'pass', p."granted_at", p."granted_by", p."collegiate_number", NULL, 'project 004 grant', now() + interval '30 days'
FROM "professionals" p
WHERE NOT EXISTS (SELECT 1 FROM "professional_badge_checks" c WHERE c."user_id" = p."user_id");
