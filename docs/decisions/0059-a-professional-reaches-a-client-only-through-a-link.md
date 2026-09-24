# 0059 — A professional reaches a client only through a consented, audited link

- **Status**: accepted
- **Date**: 2026-09-23
- **Project**: docs/projects/004-dietitian-workspace

## Context

Every query in this codebase is bounded by the `userId` from the session, and nothing else
(`packages/core/AGENTS.md`, `docs/ARCHITECTURE.md` § Invariants). Project 004 needs one
account — a dietitian-nutritionist — to read and change part of another account's data.
That is the first exception to the rule the whole ownership model rests on, and an
exception that is not named, consented, revocable and audited is a hole
(`.claude/agents/invariant-reviewer.md`, item 1).

## Decision

**A professional is a row, granted by the owner.** A `professionals` table, one row per
account (`userOwnedSingleton`), holds the collegiate number, when and by whom it was
granted. Only `POST /admin/accounts/:id/professional`, behind the admin role, writes it; no sign-up
field, request body or client state can. `user.role` is untouched: the owner may be both an
admin and a professional, and the admin guard keeps meaning one thing.

**The link is the only way in.** A `care_links` row joins a professional and a client with a
status (`active`, `paused`, `ended`), the consent version the client accepted, whether the
client also shared conditions, medications and supplements (a separate line), and whether
plans are reviewed before the client sees them. At most one `active` or `paused` link per
client (a partial unique index): clinics are out of scope.

**Professional routes carry a link id, never a client id.** Every one resolves the link by
`(link id, professional = session user, status = active)` in the repository, and the
client's `userId` comes from that row — so it is still never taken from the request, and a
link that is not the caller's, or no longer active, is a `NotFoundError` like any other
denial. One core function, `CareController.withClient`, is the only path: it resolves the
link, writes the audit row, and hands the client's id to the existing controller. Revoking a
link therefore closes access on the very next request, with no cache to expire.

*Amended 2026-09-24 (project 004 Phase 3):* the professional's list reads every active
client at once, so it cannot be one `withClient` call. `CareRepository.roster` is the only
other path to clients' data, and it keeps the same promise: in one snapshot it writes a
`list` row in the trail of every client with an active link, then reads their stages, and
returns no client id.

*Amended 2026-09-24 (project 004 Phase 4):* a **write**'s row goes in the write's own
transaction, not before it. A professional's target refused as out of bounds had left a
`targets`/`write` row for a change that never happened. `withClient` now writes a read's
row before the read, as before, and hands a write's callback a `record` function that the
writing repository calls inside its transaction. The change and its row commit together or
not at all, and a write that returns without having recorded is an error.

**Every access leaves a row the client can read.** `care_access_log` is owned by the client
(`userOwned`: it goes with the client's account), with the professional's id (set null if
the professional's account is deleted, and their name kept, so the client's record
survives), the kind of data (`overview`, `plan`, `targets`, `health`, …), read or write, and
when. It is not `audit_logs`, which is actor-indexed, carries no subject and is meant for
security events.

**An invitation reveals nothing.** It is a single-use token, stored as a hash, that expires
after 14 days, mailed to the invited address. The route does the same work and answers the
same whether or not the address has an account; the mail is sent in the background so its
timing does not answer either. Accepting requires a signed-in account whose address is the
invited one, and shows the consent list — what will be shared — before anything is stored.

## Alternatives considered

- **A `professional` value on `user.role`.** Lost because a role is single-valued: the owner
  could not be admin and professional at once, and every `@Roles('admin')` check would have
  to learn a second meaning.
- **Client id in the path, checked against a link.** Lost because it puts an id from the
  request next to a repository, which is exactly what the rule forbids; one missed check
  is a leak. With a link id, the only id a repository ever sees came from the database.
- **Reusing `audit_logs`.** Lost because the client must be able to read their own trail,
  the rows must go with the client's account, and that table is shaped around actors.

## Consequences

- `invariant-reviewer`'s "a second way in" now has exactly one answer to check against:
  `withClient`. A professional route that reaches a repository any other way is a P0.
- Every client-data read a professional makes costs one audit write.
- Clinics (several professionals, shared clients) need a new decision; the partial unique
  index is where it starts.
