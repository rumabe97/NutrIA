# 0072 — A rejected picture waits for the owner, who may accept it against the judge

- **Status**: accepted
- **Date**: 2026-09-30
- **Project**: [docs/projects/009-owner-reviews-rejected-pictures](../projects/009-owner-reviews-rejected-pictures/)
- Amends [`0066`](./0066-photograph-like-dish-pictures-drawn-on-first-view.md)
  (a rejected picture is never stored) and extends
  [`0071`](./0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md)
  (the owner's alerts).

## Context

`0066` draws a dish's picture on its first view and keeps it only if the vision judge
accepts it. A rejected picture's bytes are discarded, and "a rejected picture is never
stored" is written in four places.

- The judge rejects for one reason only: the picture shows a food carrying an allergen the
  dish does not have. It is sometimes wrong; the pilot found two false rejections.
- The owner cannot see what was rejected. He can only retry, which costs up to 0.11 USD
  and may end the same way.
- Nobody is told when pictures fail, or when the pictures' key is refused payment.
- Nothing can remove a published picture.

The architect's report
[`0005`](../reference/architecture/0005-imagenes-fallidas-aviso-y-revision-a-mano-2026-09-30.md)
measured each point against the code. The owner decided on 2026-09-30.

## Decision

- **A picture reaches a person through one of two doors.**
  - (a) `judgePicture` accepted it.
  - (b) The owner, with an admin session, accepted it by hand after seeing the allergens
    the judge flagged. That acceptance is a `picture.accepted` row in `audit_logs`, written
    in the same transaction that makes the picture `ready`.
  - In both, the published file carries its C2PA manifest, checked on those same bytes.
  - There is no third door: no retry, cron or automatic code publishes a candidate.
- **A rejected picture can be reviewed for 7 days**, as one candidate per dish; its file is
  deleted by the cleanup that follows, with no guaranteed instant. It lives in
  a private Vercel Blob store in `fra1` that only the API reads. It has no public URL, and
  its path never leaves the API.
  - The 7 days are the cool-off's own clock.
  - A dish with a candidate is not drawn again until the candidate is accepted,
    discarded, retried or expired.
- **A file without a C2PA manifest is never kept and never accepted**, by hand or
  otherwise. The manifest is what marks the picture as AI-made (`imagenes-de-platos.md`
  § 1.5, § 2.3.2).
- **What the console shows of the judge** is allergen keys and catalogue ingredients,
  never the vision model's own words.
- **A picture accepted by hand can be removed.** A picture the judge accepted cannot.
- **The owner is mailed when pictures fail.**
  - The first failure mails at once; later ones within the hour go in the next mail.
  - The mail carries counts by closed reason and a link, never a dish's name.
  - A refused payment on the pictures' key is mailed at most once in 6 hours, and so is
    a rate limit on it (owner, 2026-09-30): both give the drawing back, and either one
    lasting would stop every picture without a word.
- `0004` does not move: what a person may eat is still decided in code against the recipe.
  The vision judge was never that guarantee.

## Alternatives considered

- **A random prefix in the public store.** That is obscurity, not privacy: a URL that
  slips into a log publishes a picture the judge rejected.
- **Short-lived signed URLs.** They add a signed-token surface to save a function hop
  that costs nothing here.
- **A new table for candidates.** That is a migration for a transient datum that fits the
  row's jsonb.
- **An hourly cron to group the mails.** `0071` already refused it: it wakes Neon 24
  times a day.
- **The dish's name in the mail.** It names nobody today, but the mail rule is mechanical
  and its spec forbids it, and `recipe_source` allows `user`.
- **Asking the judge again on accept.** The judge already said no; the decision is the
  owner's.

## Consequences

- "A rejected picture is never stored" is rewritten in the code comments,
  `apps/api/AGENTS.md` and the 006 PRD's criterion as the two-door rule above.
- The automatic retry of a dish with a candidate waits for the 03:30 cleanup after day 7,
  up to 24 hours later.
- A hand-accepted picture may show an allergen the dish does not have. The dish stays
  safe, since its allergens come from the recipe, but a person with that allergy may
  distrust it. "Remove" is how that is undone.
- The mail counts by time: everything that failed between the previous mail and the
  instant it counts. A drawing that ends in the same instant as the one that mails — dated
  before the count, written after it was read — is in no mail. It is on the console at once.
  Marking each row as told would close it; it was left out as more machinery than a rare,
  visible miss deserves.
- The owner creates and connects the private store. Without its token, nothing is kept and
  the product behaves as before.
