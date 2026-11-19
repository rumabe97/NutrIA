import { and, asc, count, desc, eq, exists, gt, inArray, lte, ne, notInArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ZodError } from 'zod';

import { database } from 'database';
import { careAccessLog, careInvitations, careLinks } from 'database/schema/care';
import { checkIns } from 'database/schema/progress';
import { mealPlans } from 'database/schema/plan';
import { onboardingState, profiles, targetOverrides } from 'database/schema/profile';
import { professionals } from 'database/schema/professional';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';
import { HealthRepository, onRecord } from '#repositories/Health';
import { ProfessionalBadgeRepository } from '#repositories/Professional';
import {
  CARE_ACCESS_ACTIONS,
  CARE_ACCESS_KINDS,
  CARE_RULE_ENDINGS,
  careAccessEntrySchema,
  careInvitationSchema,
  careLinkSchema
} from 'core/entities/Care';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { linkScope } from './CareScope';

import type {
  AcceptInvitation,
  CareAccessAction,
  CareAccessEntry,
  CareAccessKind,
  CareConsentScope,
  CareInvitation,
  CareLink,
  CareLinkEndedBy,
  CareProfessionalAction,
  CareRuleEnding
} from 'core/entities/Care';
import type { Badge } from '#repositories/Professional';
import type { SQL } from 'drizzle-orm';

/** The statuses a link is still a link in. `ended` is history. */
const OPEN_STATUSES = ['active', 'paused'] as const;

/** Whether a link's client agreed to more than the plan-only list: what a badge gone narrows (`narrowLinks`). */
const widerThanPlan = or(eq(careLinks.consentScope, 'full'), eq(careLinks.sharesHealth, true));

/**
 * A professional who may work with clients today (`0061`, `docs/legal/textos/01`):
 * the practice paid for and the current agreement accepted. The condition of the
 * join on `professionals` wherever a client is reached.
 */
const practising = and(eq(professionals.practiceOpen, true), eq(professionals.agreementVersion, PROFESSIONAL_AGREEMENT_VERSION));

/**
 * Only trail rows whose action and kind this code knows. A value a later release
 * added is left out of the client's page rather than failing it, so rolling back
 * past such a release keeps every trail readable (`_enums.ts`). In the `WHERE`,
 * so the page's limit counts only rows it can show and the cursor still reaches
 * every older one.
 */
const known = and(inArray(careAccessLog.action, [...CARE_ACCESS_ACTIONS]), inArray(careAccessLog.kind, [...CARE_ACCESS_KINDS]));

/** The client's side of a link, joined under its own name: `user` is also the professional's. */
const client = alias(user, 'client');

/**
 * An active link a professional reached through `CareController.withClient`,
 * with both names: the client's, for the page, and the professional's, for the
 * snapshot the client's trail keeps — and the `scope` it opens now (`linkScope`).
 */
export type ActiveLink = {
  readonly clientName: string;
  readonly link: CareLink;
  readonly professionalName: string;
  readonly scope: CareConsentScope;
};

/** One row of a professional's list, as stored: the link, the client's name, and where they are. */
export type RosterLink = {
  readonly clientName: string;
  /**
   * The client's latest plan by version, but never one under review — the one a check-in is due on — or null.
   * `timeZone` is the client's, from their profile: a check-in is due on the client's day, not the professional's.
   */
  readonly latestPlan: { readonly answered: boolean; readonly endDate: string; readonly timeZone: string | null } | null;
  readonly link: Pick<CareLink, 'consentedAt' | 'id' | 'reviewBeforePublish' | 'sharesHealth' | 'status'>;
  readonly onboarded: boolean;
  /** Whether a plan is under way. */
  readonly planActive: boolean;
  /** Whether a plan is waiting for this professional's review (`0060`). */
  readonly planPendingReview: boolean;
  /**
   * What the link opens now (`linkScope`). Under `plan`, `latestPlan` is null
   * whatever the client has: whether a check-in was answered never leaves this
   * repository for a `plan` scope, so no stage can be derived from it.
   */
  readonly scope: CareConsentScope;
};

/** Everything on a professional's list: the live invitations, and the open links. */
export type Roster = { readonly invitations: readonly { readonly email: string; readonly expiresAt: Date }[]; readonly links: readonly RosterLink[] };

/**
 * An invitation the session's account may read, with who sent it and the
 * sender's badge as it stands now (`0111` § 2) — which list the client reads is
 * decided by it, and the number shown is the badge's, never the one typed into
 * `professionals` (PLAN 025 phase 3, step 6).
 */
export type OpenInvitation = {
  readonly badge: Badge | null;
  readonly expiresAt: Date;
  readonly professionalId: string;
  readonly professionalName: string;
};

/** A link, and the name of the professional on the other side of it. */
export type LinkWithProfessional = { readonly link: CareLink; readonly professionalName: string };

/**
 * What accepting came to. `gone` is every reason there is no invitation for
 * this account to accept — unknown, already accepted or declined, replaced by
 * a newer one, expired, addressed to somebody else, sent by an account that is
 * no longer a professional — and is deliberately one outcome: the caller
 * answers all of them with the same 404.
 */
export type AcceptOutcome =
  | ({ readonly kind: 'created' } & LinkWithProfessional)
  | ({ readonly kind: 'exists' } & LinkWithProfessional)
  | { readonly kind: 'gone' }
  | { readonly kind: 'refused' };

/** A link the illness rule ended (`0111` § 8): whose, and the practitioner's name the client's notice carries. */
export type RuleEnding = { readonly clientId: string; readonly linkId: string; readonly professionalName: string };

/** The client's latest link, when the illness rule ended it: the name, when, and which of its two endings (`CARE_RULE_ENDINGS`). */
export type EndedByRule = { readonly endedAt: Date; readonly professionalName: string; readonly reason: CareRuleEnding };

/**
 * What inviting came to (`0061`): the invitation, or the practice's reason
 * there is none — `closed` (no practice paid for, or no longer a
 * professional), `full` (the plan's number is reached, and which number).
 */
export type InviteOutcome =
  | { readonly includedClients: number; readonly kind: 'full' }
  | { readonly invitation: CareInvitation; readonly kind: 'invited' }
  | { readonly kind: 'closed' };

/** How much of a practice is in use: active links, and invitations still live. */
export type PracticeUse = { readonly activeClients: number; readonly pendingInvitations: number };

/**
 * An invitation this account may still answer: the token's hash, addressed to
 * the session's own address, not expired, and not sent by this same account.
 * Accepted, declined and replaced need no condition: those rows are deleted.
 *
 * Every condition is in the `WHERE`, so every reason for "no" costs the same
 * query and comes back the same empty result. The address is the ownership
 * boundary here as `userId` is everywhere else — the session's, never the
 * request's.
 */
function answerable(tokenHash: string, email: string, clientId: string, now: Date): SQL | undefined {
  return and(
    eq(careInvitations.tokenHash, tokenHash),
    eq(careInvitations.email, email),
    gt(careInvitations.expiresAt, now),
    ne(careInvitations.professionalId, clientId)
  );
}

export const CareRepository = {
  /**
   * The client accepts (`0059`): the link is made and the invitation deleted,
   * in one transaction, or neither.
   *
   * The invitation row is held `FOR UPDATE` first, so two acceptances of one
   * token queue here and the second finds it gone. One open link per client is
   * the partial unique index `care_links_one_open_per_client`, not a read
   * before the insert: the insert does nothing on a conflict, and then the link
   * in the way is read and named — the invitation stays unanswered, so the
   * client can end that link and come back to this one.
   *
   * The inviter must still be a professional: an inner join on `professionals`,
   * so an invitation from an account whose grant was taken back is `gone`.
   *
   * The practice's row is held `FOR SHARE` before the invitation, in the order
   * `invite` takes them (`0061`): an acceptance cannot commit between the two
   * counts `invite` makes, so the number is never overshot, and taking the
   * rows in one order means the two never deadlock. A practice not paid for
   * gets the link `paused`, as a lapse leaves the others, and paying again
   * reactivates it with them.
   *
   * **The consent's scope is recorded here** (`0111` § 4, PLAN 025 phase 5 step
   * 2), from the practitioner's badge read at this moment: `full` only when the
   * badge stands **and** the client did not say they read the plan-only list;
   * `plan` otherwise, with the health line off whatever the body says — it opens
   * nothing outside `full`. A badge gained later widens nothing until the client
   * re-consents (`reconsent`).
   *
   * **The illness rule** (`0111` § 8, PRD 025 criterion 22): with the
   * practitioner un-badged and a condition or a medication on the client's
   * record (`onRecord`), nothing is written — the invitation stays, unanswered,
   * to expire like any other — and the answer is `refused`. The client's row is
   * held (`lockClient`) before the record is read, as `endOnDeclaration` holds it
   * before it reads the link, so an acceptance and a declaration sent together
   * queue, and the second sees what the first committed.
   */
  async accept(clientId: string, email: string, tokenHash: string, answer: AcceptInvitation, now: Date): Promise<AcceptOutcome> {
    try {
      return await database().transaction(async (tx): Promise<AcceptOutcome> => {
        const [addressed] = await tx
          .select({ professionalId: careInvitations.professionalId })
          .from(careInvitations)
          .where(answerable(tokenHash, email, clientId, now))
          .limit(1);

        if (!addressed) {
          return { kind: 'gone' };
        }

        const [practice] = await tx
          .select({ open: professionals.practiceOpen })
          .from(professionals)
          .where(eq(professionals.userId, addressed.professionalId))
          .for('share');

        const [invitation] = await tx
          .select({ id: careInvitations.id, professionalId: careInvitations.professionalId, professionalName: user.name })
          .from(careInvitations)
          .innerJoin(professionals, eq(professionals.userId, careInvitations.professionalId))
          .innerJoin(user, eq(user.id, careInvitations.professionalId))
          .where(answerable(tokenHash, email, clientId, now))
          .limit(1)
          .for('update', { of: careInvitations });

        if (!invitation || !practice) {
          return { kind: 'gone' };
        }

        await lockClient(tx, clientId);

        // The badge as it stands now, on this transaction's own connection: one definition, never cached (`0111` § 2).
        const badged = (await ProfessionalBadgeRepository.badgeOf(invitation.professionalId, now, tx)) !== null;

        if (!badged && (await HealthRepository.hasRecord(clientId, tx))) {
          return { kind: 'refused' };
        }

        const consentScope: CareConsentScope = badged && answer.consentScope === 'full' ? 'full' : 'plan';

        const [created] = await tx
          .insert(careLinks)
          .values({
            clientId,
            consentedAt: now,
            // Named on every insert (PLAN 025 phase 5 step 0): the column's default is to go.
            consentScope,
            consentVersion: answer.consentVersion,
            professionalId: invitation.professionalId,
            sharesHealth: consentScope === 'full' && answer.sharesHealth,
            status: practice.open ? 'active' : 'paused'
          })
          .onConflictDoNothing()
          .returning();

        if (!created) {
          const [existing] = await tx
            .select({ link: careLinks, professionalName: user.name })
            .from(careLinks)
            .innerJoin(user, eq(user.id, careLinks.professionalId))
            .where(and(eq(careLinks.clientId, clientId), inArray(careLinks.status, [...OPEN_STATUSES])))
            .limit(1);

          if (!existing) {
            throw new DatabaseOperationError('Care link insert conflicted with no open link');
          }

          return { kind: 'exists', link: careLinkSchema.parse(existing.link), professionalName: existing.professionalName };
        }

        await tx.delete(careInvitations).where(eq(careInvitations.id, invitation.id));

        return { kind: 'created', link: careLinkSchema.parse(created), professionalName: invitation.professionalName };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One page of the client's own trail, newest first — `clientId` is the
   * session's and the only filter: the rows strictly older than
   * the row `beforeId` names (by `createdAt`, then `id`, the order's two keys),
   * or the newest when there is none. The cursor is compared in the database:
   * a JavaScript date keeps milliseconds, `createdAt` keeps microseconds. A
   * `beforeId` that is not one of this client's rows is an empty page.
   */
  async accessLog(clientId: string, limit: number, beforeId: string | null = null): Promise<readonly CareAccessEntry[]> {
    try {
      const older = beforeId
        ? sql`(${careAccessLog.createdAt}, ${careAccessLog.id}) < (select c.created_at, c.id from ${careAccessLog} c where c.id = ${beforeId} and c.user_id = ${clientId})`
        : undefined;
      const rows = await database()
        .select()
        .from(careAccessLog)
        .where(and(eq(careAccessLog.userId, clientId), known, older))
        .orderBy(desc(careAccessLog.createdAt), desc(careAccessLog.id))
        .limit(limit);

      return rows.map(row => careAccessEntrySchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The one question `CareController.withClient` asks (`0059`): is this link
   * the professional's, active, and are they still a professional with a
   * practice paid for and the current agreement accepted? All of it is the
   * `WHERE` and the joins — the link id, `professionalId` (the session's),
   * `status = 'active'`, and an inner join on `professionals` that is
   * `practising` (`0061`, `docs/legal/textos/01`), so a grant taken back, a
   * practice lapsed or a new agreement not yet accepted closes the door on the
   * next request. Every reason for
   * "no" is the same empty result.
   *
   * **The only query that turns a professional's session into another
   * account's id**: the client's id leaves this method inside the link, and
   * only `withClient` calls it.
   *
   * It answers the link's `scope` too (`0111` § 4, `linkScope`): the badge is
   * read here, for `professionalId` (the session's), on every call — never
   * cached, never taken from the caller — so a badge that lapsed or was
   * withdrawn narrows this very request.
   */
  async activeLink(professionalId: string, linkId: string, now: Date = new Date()): Promise<ActiveLink | null> {
    try {
      const [row] = await database()
        .select({ clientName: client.name, link: careLinks, professionalName: user.name })
        .from(careLinks)
        .innerJoin(professionals, and(eq(professionals.userId, careLinks.professionalId), practising))
        .innerJoin(user, eq(user.id, careLinks.professionalId))
        .innerJoin(client, eq(client.id, careLinks.clientId))
        .where(and(eq(careLinks.id, linkId), eq(careLinks.professionalId, professionalId), eq(careLinks.status, 'active')))
        .limit(1);

      if (!row) {
        return null;
      }

      const link = careLinkSchema.parse(row.link);
      const badge = await ProfessionalBadgeRepository.badgeOf(professionalId, now);

      return { clientName: row.clientName, link, professionalName: row.professionalName, scope: linkScope(link.consentScope, badge !== null) };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The client's own open link — `active` or `paused` — with the professional's
   * name, or null. `clientId` is the session's, and the only filter.
   */
  async clientLink(clientId: string): Promise<LinkWithProfessional | null> {
    try {
      const [row] = await database()
        .select({ link: careLinks, professionalName: user.name })
        .from(careLinks)
        .innerJoin(user, eq(user.id, careLinks.professionalId))
        .where(and(eq(careLinks.clientId, clientId), inArray(careLinks.status, [...OPEN_STATUSES])))
        .limit(1);

      return row ? { link: careLinkSchema.parse(row.link), professionalName: row.professionalName } : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Whether this client has the paid allowances through their professional
   * (`0061`): an `active` link to a professional whose practice is paid for.
   * `clientId` is the session's — the client's own question about themselves
   * — and the only filter. A paused or ended link, a practice lapsed, a grant
   * taken back: no.
   */
  async coveredByOpenPractice(clientId: string): Promise<boolean> {
    try {
      const [row] = await database()
        .select({ id: careLinks.id })
        .from(careLinks)
        .innerJoin(professionals, and(eq(professionals.userId, careLinks.professionalId), eq(professionals.practiceOpen, true)))
        .where(and(eq(careLinks.clientId, clientId), eq(careLinks.status, 'active')))
        .limit(1);

      return row !== undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The client says no: the invitation is deleted and nothing else is written.
   * The same conditions as reading it, in one guarded `DELETE`, so a declined,
   * accepted or foreign token changes nothing and says so the same way.
   */
  async decline(clientId: string, email: string, tokenHash: string, now: Date): Promise<boolean> {
    try {
      const db = database();
      const rows = await db
        .delete(careInvitations)
        .where(
          and(
            answerable(tokenHash, email, clientId, now),
            exists(db.select({ userId: professionals.userId }).from(professionals).where(eq(professionals.userId, careInvitations.professionalId)))
          )
        )
        .returning({ id: careInvitations.id });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Ends a link from one side. `side` names which column the session's id is
   * matched against — the client's or the professional's — so a caller can
   * only ever end a link they are on, and only a link that is still open.
   * Returns false when there is no such link, which the caller answers as 404.
   * One guarded `UPDATE`: ownership and status are its `WHERE`.
   *
   * **The targets stay, and become the client's own** (owner's decision,
   * 2026-09-24). In the same transaction, the client's target override loses
   * its mark — `setByProfessionalId` — but only where the mark names this
   * link's professional, both ids taken from the row just ended, never from
   * the caller. The numbers are not written. So a second professional never
   * reads an earlier one's name, and the client's screens show the targets as
   * theirs. A pause is not an end and keeps the mark: it is written elsewhere
   * (`BillingRepository`), and never here.
   */
  async end(userId: string, side: Extract<CareLinkEndedBy, 'client' | 'professional'>, linkId: string, now: Date): Promise<boolean> {
    try {
      const owner = side === 'client' ? careLinks.clientId : careLinks.professionalId;

      return await database().transaction(async tx => (await endLinks(tx, and(eq(careLinks.id, linkId), eq(owner, userId)), side, now)).length > 0);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * **The illness rule, on a declaration** (`0111` § 8, PRD 025 criterion 22):
   * run by `HealthController.replace` inside the transaction that writes the
   * health section (`tx`), after it is written. With a condition or a medication
   * now on the client's record (`onRecord`) and their open link — `active` or
   * `paused` — to a practitioner whose badge does not stand now, that link ends
   * in the same transaction, exactly as `end` ends it, the targets' mark
   * included.
   *
   * Recorded `ended_by = 'declared'`, so the client's own screen can say why
   * even if the answer to their save never arrived (`lastEndedByRule`); to the
   * practitioner it is, as legal F4 requires, an ending by the client and nothing
   * else (`endedByForPractitioner`). Nothing is queued to anybody here.
   *
   * The client's row is held first (`lockClient`), as `accept` holds it before
   * it reads the record, so a declaration and an acceptance sent together queue
   * and the second sees what the first committed. `clientId` is the session's.
   */
  async endOnDeclaration(clientId: string, now: Date, tx: Transaction): Promise<RuleEnding | null> {
    try {
      await lockClient(tx, clientId);

      if (!(await HealthRepository.hasRecord(clientId, tx))) {
        return null;
      }

      const [open] = await tx
        .select({ id: careLinks.id, professionalId: careLinks.professionalId, professionalName: user.name })
        .from(careLinks)
        .innerJoin(user, eq(user.id, careLinks.professionalId))
        .where(and(eq(careLinks.clientId, clientId), inArray(careLinks.status, [...OPEN_STATUSES])))
        .limit(1);

      if (!open || (await ProfessionalBadgeRepository.badgeOf(open.professionalId, now, tx)) !== null) {
        return null;
      }

      const ended = await endLinks(tx, and(eq(careLinks.id, open.id), eq(careLinks.clientId, clientId)), 'declared', now);

      return ended.length > 0 ? { clientId, linkId: open.id, professionalName: open.professionalName } : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * An account is being deleted: every invitation addressed to its address
   * goes with it, whoever sent it (PRD 004, criterion 14). The address is the
   * deleted account's own, from Better Auth's session — the only key an
   * invitation has to its recipient, since it references no account. One
   * `DELETE`, idempotent.
   */
  async forgetAddress(email: string): Promise<void> {
    try {
      await database().delete(careInvitations).where(eq(careInvitations.email, email));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every invitation past its date, whoever sent it: the address in it was kept
   * for the invitation and nothing else, and the invitation mail promises it goes
   * by the day after it expires (RGPD art. 14, `docs/legal/textos/06` § A). One `DELETE`,
   * idempotent; answers how many went.
   */
  async forgetExpired(now: Date): Promise<number> {
    try {
      const rows = await database().delete(careInvitations).where(lte(careInvitations.expiresAt, now)).returning({ id: careInvitations.id });

      return rows.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A professional invites an address (`0059`). Only the token's hash is
   * written.
   *
   * One live row per professional and address: in one transaction, the
   * earlier invitation to this address is deleted — its token stops working,
   * the newest mail is the one that works — together with every invitation that
   * has expired, whoever sent it, so no address outlives its use by longer than
   * the next invitation anybody writes.
   *
   * Two identical invitations sent at once both find nothing to delete, and
   * the second insert meets the first on `care_invitations_one_per_address`.
   * `ON CONFLICT DO UPDATE` makes the second the replacement instead of a
   * 23505, so both requests answer exactly as a lone one does.
   *
   * Nothing here reads `user`: whether the address has an account is not a
   * question this method can ask, which is what makes the route's answer the
   * same either way.
   *
   * **The practice's number is spent here** (`0061`): active links plus live
   * invitations may not reach `includedClients`. The professional's row is
   * held `FOR UPDATE` first — the row the allowance belongs to — so two
   * invitations sent at once count one after the other, and the count and the
   * insert are one decision. The invitation this one replaces (the same
   * address) is not counted: it is about to be the same seat. A practice not
   * paid for, an agreement not accepted at its current version, or an account
   * no longer a professional, is `closed`. Nothing is written unless the
   * invitation is.
   */
  async invite(professionalId: string, email: string, tokenHash: string, expiresAt: Date, now: Date): Promise<InviteOutcome> {
    try {
      return await database().transaction(async (tx): Promise<InviteOutcome> => {
        const [practice] = await tx
          .select({
            agreementVersion: professionals.agreementVersion,
            includedClients: professionals.includedClients,
            open: professionals.practiceOpen
          })
          .from(professionals)
          .where(eq(professionals.userId, professionalId))
          .for('update');

        if (!practice?.open || practice.agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION) {
          return { kind: 'closed' };
        }

        const [links, invitations] = await Promise.all([
          tx
            .select({ total: count() })
            .from(careLinks)
            .where(and(eq(careLinks.professionalId, professionalId), eq(careLinks.status, 'active'))),
          tx
            .select({ total: count() })
            .from(careInvitations)
            .where(and(eq(careInvitations.professionalId, professionalId), gt(careInvitations.expiresAt, now), ne(careInvitations.email, email)))
        ]);

        if ((links[0]?.total ?? 0) + (invitations[0]?.total ?? 0) >= practice.includedClients) {
          return { includedClients: practice.includedClients, kind: 'full' };
        }

        await tx
          .delete(careInvitations)
          .where(or(and(eq(careInvitations.professionalId, professionalId), eq(careInvitations.email, email)), lte(careInvitations.expiresAt, now)));

        const [row] = await tx
          .insert(careInvitations)
          .values({ email, expiresAt, professionalId, tokenHash })
          .onConflictDoUpdate({
            set: { createdAt: now, expiresAt, tokenHash, updatedAt: now },
            target: [careInvitations.professionalId, careInvitations.email]
          })
          .returning();

        return { invitation: careInvitationSchema.parse(row), kind: 'invited' };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The client's latest link, when the illness rule ended it — the sweep
   * (`badge_lost`) or their own declaration (`declared`) — with which, or null:
   * so the client's own screen can say plainly what happened
   * (`docs/legal/textos/05` § G.3), as the mail of `textos/06` § Y promises, and
   * even when the answer to a save was lost. A newer link, open or ended any
   * other way, is the latest and answers null. `clientId` is the session's, and
   * the only filter.
   */
  async lastEndedByRule(clientId: string): Promise<EndedByRule | null> {
    try {
      const [row] = await database()
        .select({ endedAt: careLinks.endedAt, endedBy: careLinks.endedBy, professionalName: user.name })
        .from(careLinks)
        .innerJoin(user, eq(user.id, careLinks.professionalId))
        .where(eq(careLinks.clientId, clientId))
        .orderBy(desc(careLinks.createdAt), desc(careLinks.id))
        .limit(1);

      const reason = CARE_RULE_ENDINGS.find(ending => ending === row?.endedBy);

      return reason && row?.endedAt ? { endedAt: row.endedAt, professionalName: row.professionalName, reason } : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One row of the client's trail. `clientId` came from an active link that
   * `withClient` has just resolved against the professional's session — never
   * from a request.
   *
   * A read's row is an insert of its own, before the data is read: a read
   * without its row is the one outcome the trail exists to rule out, so a
   * failure here fails the read. A write's row goes in the write's own
   * transaction (`tx`), so a refused or failed write leaves no row, and a
   * write that commits always has one.
   */
  async logAccess(
    clientId: string,
    entry: {
      readonly action: CareProfessionalAction;
      readonly kind: CareAccessKind;
      readonly linkId: string;
      readonly professionalId: string;
      readonly professionalName: string;
    },
    tx?: Transaction
  ): Promise<void> {
    try {
      await (tx ?? database()).insert(careAccessLog).values({ ...entry, userId: clientId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * **A badge taken back by the owner** (`0111` § 4, PRD 025 criterion 12): run
   * inside the owner's removal transaction (`ProfessionalBadgeRepository.remove`,
   * handed down by `ProfessionalBadgeController.remove`), so every open link of
   * that practitioner narrows for good at the same moment — `consent_scope =
   * 'plan'`, the health line off — and a badge granted again later widens nothing
   * until each client's own `reconsent`. Ending a link under the illness rule
   * stays the sweep's (`sweepBadgeLoss`): `0111` § 8 has three points and no
   * fourth. Answers how many narrowed; nothing is sent to anybody.
   */
  async narrowLinksOf(professionalId: string, now: Date, tx: Transaction): Promise<number> {
    try {
      return await narrowLinks(tx, eq(careLinks.professionalId, professionalId), now);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The invitation behind a token, for the account it was sent to — or null
   * for every other case, alike. The inviter must still be a professional.
   */
  async openInvitation(clientId: string, email: string, tokenHash: string, now: Date): Promise<OpenInvitation | null> {
    try {
      const [row] = await database()
        .select({ expiresAt: careInvitations.expiresAt, professionalId: careInvitations.professionalId, professionalName: user.name })
        .from(careInvitations)
        .innerJoin(professionals, eq(professionals.userId, careInvitations.professionalId))
        .innerJoin(user, eq(user.id, careInvitations.professionalId))
        .where(answerable(tokenHash, email, clientId, now))
        .limit(1);

      if (!row) {
        return null;
      }

      return { ...row, badge: await ProfessionalBadgeRepository.badgeOf(row.professionalId, now) };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * How much of the professional's practice is in use (`0061`): counts only,
   * by `professionalId` (the session's) — no client, no address, and so no
   * row in anybody's trail.
   */
  async practiceUse(professionalId: string, now: Date): Promise<PracticeUse> {
    try {
      const db = database();
      const [links, invitations] = await Promise.all([
        db
          .select({ total: count() })
          .from(careLinks)
          .where(and(eq(careLinks.professionalId, professionalId), eq(careLinks.status, 'active'))),
        db
          .select({ total: count() })
          .from(careInvitations)
          .where(and(eq(careInvitations.professionalId, professionalId), gt(careInvitations.expiresAt, now)))
      ]);

      return { activeClients: links[0]?.total ?? 0, pendingInvitations: invitations[0]?.total ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The client widens their own open link to the badged list (`0111` § 4,
   * `docs/legal/textos/05` § F.4, PLAN 025 phase 5 step 2): only a link consented
   * to `plan`, only while the practitioner's badge stands — read now — and
   * the widening leaves its own evidence: `scope_consented_at` and
   * `scope_consent_version`, written here and nowhere else. Nothing else moves —
   * not `consentedAt` and `consentVersion` (what was accepted, and when: the
   * link's "since"), not the health line, which stays its own yes or no.
   * Null for every other case — no open link, already `full`, no badge — and
   * nothing is written. `clientId` is the session's, and the only filter.
   */
  async reconsent(clientId: string, consentVersion: string, now: Date): Promise<LinkWithProfessional | null> {
    try {
      return await database().transaction(async tx => {
        const open = and(eq(careLinks.clientId, clientId), inArray(careLinks.status, [...OPEN_STATUSES]));
        const [row] = await tx
          .select({ link: careLinks, professionalName: user.name })
          .from(careLinks)
          .innerJoin(user, eq(user.id, careLinks.professionalId))
          .where(and(open, eq(careLinks.consentScope, 'plan')))
          .limit(1)
          .for('update', { of: careLinks });

        if (!row) {
          return null;
        }

        const link = careLinkSchema.parse(row.link);

        if ((await ProfessionalBadgeRepository.badgeOf(link.professionalId, now, tx)) === null) {
          return null;
        }

        const widened = { consentScope: 'full', scopeConsentedAt: now, scopeConsentVersion: consentVersion, updatedAt: now } as const;

        await tx
          .update(careLinks)
          .set(widened)
          .where(and(eq(careLinks.id, link.id), open));

        return { link: { ...link, ...widened }, professionalName: row.professionalName };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A professional's list: their live invitations and their open links, with
   * where each client stands — from stored state only.
   *
   * Every query is bounded by `professionalId`, the session's, through
   * `care_links`: a client's plans, check-ins and onboarding are reached only
   * by joining them to a link of this professional's, and only for an `active`
   * one (a paused link shows its name and status, nothing of where the client
   * is). No client id leaves this method — rows are keyed by link id, which is
   * all a professional route ever takes.
   *
   * The latest plan is the highest version whatever its status except
   * `pending_review`, as `CheckInController.status` reads it, so "check-in
   * due" here and on the client's own screen are the same fact; a plan under
   * review (`0060`) is `planPendingReview` instead.
   */
  async roster(professionalId: string, now: Date): Promise<Roster> {
    try {
      // The badge as it stands now, read once for the whole list: with each link's
      // own consent it is that row's scope (`linkScope`, `0111` § 4).
      const badged = (await ProfessionalBadgeRepository.badgeOf(professionalId, now)) !== null;

      // One snapshot for the rows written and the facts read: every client whose stage is
      // worked out below has had their `list` row written first, and no other client has.
      return await database().transaction(
        async db => {
          await db.insert(careAccessLog).select(
            db
              // Every column, in the table's order: drizzle's insert-select asks for both.
              /* eslint-disable perfectionist/sort-objects -- the order is the table's, not the alphabet's */
              .select({
                id: sql<string>`gen_random_uuid()`.as('id'),
                userId: careLinks.clientId,
                action: sql<CareAccessAction>`'read'::care_access_action`.as('action'),
                kind: sql<CareAccessKind>`'list'::care_access_kind`.as('kind'),
                linkId: careLinks.id,
                professionalId: careLinks.professionalId,
                professionalName: user.name,
                createdAt: sql<Date>`now()`.as('created_at'),
                updatedAt: sql<Date>`now()`.as('updated_at')
              })
              /* eslint-enable perfectionist/sort-objects */
              .from(careLinks)
              .innerJoin(professionals, eq(professionals.userId, careLinks.professionalId))
              .innerJoin(user, eq(user.id, careLinks.professionalId))
              .where(and(eq(careLinks.professionalId, professionalId), eq(careLinks.status, 'active')))
          );

          return await rosterOf(db, professionalId, now, badged);
        },
        { isolationLevel: 'repeatable read' }
      );
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Turns review before publishing on or off for one link (`0060`), with the
   * professional's trail row (`record`) in the same transaction. Guarded by
   * the link id, the professional (the session's) and `active`, as
   * `activeLink` resolved it; null when the link closed in between. A plan
   * already pending stays pending: turning review off publishes nothing.
   */
  async setReview(professionalId: string, linkId: string, reviewBeforePublish: boolean, record: RecordAccess): Promise<CareLink | null> {
    try {
      return await database().transaction(async tx => {
        const [row] = await tx
          .update(careLinks)
          .set({ reviewBeforePublish, updatedAt: new Date() })
          .where(and(eq(careLinks.id, linkId), eq(careLinks.professionalId, professionalId), eq(careLinks.status, 'active')))
          .returning();

        if (!row) {
          return null;
        }

        await record(tx);

        return careLinkSchema.parse(row);
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The client starts or stops sharing the health line on their own open link
   * (`docs/legal/analysis.md` P0-1), without ending it. `clientId` is the
   * session's and the ownership boundary; the link is whichever is `active` or
   * `paused` — there is at most one, held `FOR UPDATE` while it changes.
   *
   * **Starting is refused outside `full`** (`0111` § 4, PRD 025 criterion 11,
   * PLAN phase 5 step 3): with the practitioner's badge not standing now, or the
   * link consented to the plan-only list, the answer is null — the same as no
   * link — and nothing is written. Stopping always works: a consent is as easy
   * to take back as it was to give (RGPD art. 7.3).
   *
   * A change and its row in the client's trail — `health`, `granted` or
   * `withdrawn`, under that link, naming the professional — are one
   * transaction, or neither. Asking for what already holds changes nothing and
   * writes no row. Null when the client has no open link. Every professional
   * read resolves the link afresh (`activeLink`), so turning it off closes the
   * health line on the very next request.
   */
  async setSharesHealth(clientId: string, sharesHealth: boolean, now: Date): Promise<LinkWithProfessional | null> {
    try {
      return await database().transaction(async tx => {
        const open = and(eq(careLinks.clientId, clientId), inArray(careLinks.status, [...OPEN_STATUSES]));
        const [row] = await tx
          .select({ link: careLinks, professionalName: user.name })
          .from(careLinks)
          .innerJoin(user, eq(user.id, careLinks.professionalId))
          .where(open)
          .limit(1)
          .for('update', { of: careLinks });

        if (!row) {
          return null;
        }

        const link = careLinkSchema.parse(row.link);

        if (sharesHealth && !(await opensFull(link, now, tx))) {
          return null;
        }

        const [changed] = await tx
          .update(careLinks)
          .set({ sharesHealth, updatedAt: now })
          .where(and(open, ne(careLinks.sharesHealth, sharesHealth)))
          .returning({ id: careLinks.id });

        if (!changed) {
          return { link, professionalName: row.professionalName };
        }

        await tx
          .insert(careAccessLog)
          .values({
            action: sharesHealth ? 'granted' : 'withdrawn',
            kind: 'health',
            linkId: link.id,
            professionalId: link.professionalId,
            professionalName: row.professionalName,
            userId: clientId
          });

        return { link: { ...link, sharesHealth, updatedAt: now }, professionalName: row.professionalName };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * **A badge gone, in the daily sweep** (`0111` §§ 4 and 8, PRD 025 criteria 12
   * and 22). For every open link — `active` or `paused` — whose practitioner's
   * badge does not stand now:
   *
   * - **the illness rule**: when the client has a condition or a medication on
   *   record (`onRecord`), the link ends, exactly as `end` ends one, the targets'
   *   mark included, recorded `ended_by = 'badge_lost'` — so the client's own
   *   screen can say why (`lastEndedByRule`), while a practitioner never reads it
   *   as anything but `client` (`endedByForPractitioner`, legal F4);
   * - **the others narrow for good** (`narrowLinks`): `consent_scope = 'plan'`,
   *   the health line off — a badge that comes back widens nothing by itself, only
   *   the client's own `reconsent` does.
   *
   * State-based, not "the badges that lapsed this run": a badge past its date
   * with no `lapsed` row yet is just as gone (`badgesOf`, the one definition).
   * Inside the write the badges are read again, on the write's own connection,
   * so a pass the owner recorded since the first read keeps its links; the
   * `UPDATE` asks again that the link is open (and, to end it, that the record is
   * still there). Answers the endings, for the client's mail (`textos/06` § Y),
   * and how many links narrowed; narrowing mails nobody.
   */
  async sweepBadgeLoss(now: Date): Promise<{ readonly ended: readonly RuleEnding[]; readonly narrowed: number }> {
    try {
      const candidates = await database()
        .select({ id: careLinks.id, professionalId: careLinks.professionalId, professionalName: user.name })
        .from(careLinks)
        .innerJoin(user, eq(user.id, careLinks.professionalId))
        .where(and(inArray(careLinks.status, [...OPEN_STATUSES]), or(widerThanPlan, onRecord(careLinks.clientId))));

      if (candidates.length === 0) {
        return { ended: [], narrowed: 0 };
      }

      const badges = await ProfessionalBadgeRepository.badgesOf([...new Set(candidates.map(row => row.professionalId))], now);
      const unbadged = candidates.filter(row => !badges.has(row.professionalId));

      if (unbadged.length === 0) {
        return { ended: [], narrowed: 0 };
      }

      const names = new Map(unbadged.map(row => [row.id, row.professionalName]));
      const outcome = await database().transaction(async tx => {
        const still = await ProfessionalBadgeRepository.badgesOf([...new Set(unbadged.map(row => row.professionalId))], now, tx);
        const ids = unbadged.filter(row => !still.has(row.professionalId)).map(row => row.id);

        if (ids.length === 0) {
          return { ended: [], narrowed: 0 };
        }

        // Ended first: a link that ends is not narrowed as well, and `narrowLinks` touches open links only.
        const ended = await endLinks(tx, and(inArray(careLinks.id, ids), onRecord(careLinks.clientId)), 'badge_lost', now);

        return { ended, narrowed: await narrowLinks(tx, inArray(careLinks.id, ids), now) };
      });

      return {
        ended: outcome.ended.map(link => ({ clientId: link.clientId, linkId: link.id, professionalName: names.get(link.id) ?? '' })),
        narrowed: outcome.narrowed
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

/**
 * What `roster` reads, inside its transaction. Only links whose grant stands:
 * the join on `professionals` is the same second line `activeLink` keeps.
 * `badged` is the professional's badge now, read by the caller: with each
 * link's own consent it decides the row's `scope` (`linkScope`).
 */
async function rosterOf(db: Transaction, professionalId: string, now: Date, badged: boolean): Promise<Roster> {
  const seen = rosterPlansSeen(badged);
  const [invitations, links, latest] = await Promise.all([
    db
      .select({ email: careInvitations.email, expiresAt: careInvitations.expiresAt })
      .from(careInvitations)
      .where(and(eq(careInvitations.professionalId, professionalId), gt(careInvitations.expiresAt, now)))
      .orderBy(desc(careInvitations.createdAt)),
    db
      .select({
        id: careLinks.id,
        clientName: client.name,
        consentedAt: careLinks.consentedAt,
        consentScope: careLinks.consentScope,
        onboarded: sql<boolean>`${onboardingState.completedAt} is not null`,
        planActive: sql<boolean>`${careLinks.status} = 'active' and ${exists(
          db
            .select({ id: mealPlans.id })
            .from(mealPlans)
            .where(and(eq(mealPlans.userId, careLinks.clientId), eq(mealPlans.status, 'active'), seen))
        )}`,
        planPendingReview: sql<boolean>`${careLinks.status} = 'active' and ${exists(
          db
            .select({ id: mealPlans.id })
            .from(mealPlans)
            .where(and(eq(mealPlans.userId, careLinks.clientId), eq(mealPlans.status, 'pending_review'), seen))
        )}`,
        reviewBeforePublish: careLinks.reviewBeforePublish,
        sharesHealth: careLinks.sharesHealth,
        status: careLinks.status
      })
      .from(careLinks)
      .innerJoin(professionals, eq(professionals.userId, careLinks.professionalId))
      .innerJoin(client, eq(client.id, careLinks.clientId))
      .leftJoin(onboardingState, and(eq(onboardingState.userId, careLinks.clientId), eq(careLinks.status, 'active')))
      .where(and(eq(careLinks.professionalId, professionalId), inArray(careLinks.status, [...OPEN_STATUSES])))
      .orderBy(asc(client.name), asc(careLinks.consentedAt)),
    db
      .selectDistinctOn([mealPlans.userId], {
        answered: sql<boolean>`${exists(
          db
            .select({ id: checkIns.id })
            .from(checkIns)
            .where(and(eq(checkIns.userId, mealPlans.userId), eq(checkIns.planId, mealPlans.id)))
        )}`,
        endDate: mealPlans.endDate,
        linkId: careLinks.id,
        timeZone: profiles.timezone
      })
      .from(mealPlans)
      .innerJoin(careLinks, eq(careLinks.clientId, mealPlans.userId))
      .leftJoin(profiles, eq(profiles.userId, mealPlans.userId))
      // A plan waiting for its day (project 015) has not started: the stage is the plan being lived.
      .where(
        and(
          eq(careLinks.professionalId, professionalId),
          eq(careLinks.status, 'active'),
          notInArray(mealPlans.status, ['pending_review', 'scheduled'])
        )
      )
      .orderBy(mealPlans.userId, desc(mealPlans.version))
  ]);

  return {
    invitations,
    links: links.map(row => {
      const scope = linkScope(row.consentScope, badged);

      return {
        clientName: row.clientName,
        // Never carried for a `plan` scope: a check-in is not theirs to know about.
        latestPlan: scope === 'full' ? latestOf(latest, row.id) : null,
        link: {
          id: row.id,
          consentedAt: row.consentedAt,
          reviewBeforePublish: row.reviewBeforePublish,
          sharesHealth: row.sharesHealth,
          status: row.status
        },
        onboarded: row.onboarded,
        planActive: row.planActive,
        planPendingReview: row.planPendingReview,
        scope
      };
    })
  };
}

/**
 * Which of the client's plans a roster row's stage may look at (`0111` § 5),
 * as a condition on `meal_plans` beside `care_links`: every plan under a `full`
 * scope (the badge stands and the link's consent is `full`), only the plans
 * made through the link under `plan` — so the list never says a plan is under
 * way, or waiting, that the client's page would not show.
 */
export function rosterPlansSeen(badged: boolean): SQL | undefined {
  return badged ? or(eq(careLinks.consentScope, 'full'), eq(mealPlans.careLinkId, careLinks.id)) : eq(mealPlans.careLinkId, careLinks.id);
}

/** The latest plan behind one link, from the per-client rows `roster` read. */
function latestOf(
  rows: readonly { readonly answered: boolean; readonly endDate: string; readonly linkId: string; readonly timeZone: string | null }[],
  linkId: string
): RosterLink['latestPlan'] {
  const row = rows.find(candidate => candidate.linkId === linkId);

  return row ? { answered: row.answered, endDate: row.endDate, timeZone: row.timeZone } : null;
}

type Transaction = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

/**
 * Holds the client's account row for the rest of `tx` — `FOR NO KEY UPDATE`, so
 * a row elsewhere that only references the account (`FOR KEY SHARE`) is never
 * kept waiting. The illness rule's two transactional points take it before they
 * read: `accept` before the health record, `endOnDeclaration` before the link,
 * so the two queue on the client and neither misses the other's commit under
 * READ COMMITTED.
 */
async function lockClient(tx: Transaction, clientId: string): Promise<void> {
  await tx.select({ id: user.id }).from(user).where(eq(user.id, clientId)).for('no key update');
}

/**
 * Ends every open link `where` names, as `by`, inside `tx` — the one way a link
 * ends, whoever or whatever ends it — and, for each, takes the professional's
 * mark off the client's targets: they stay, and become the client's own (owner's
 * decision, 2026-09-24). Both ids come from the ended row, never from a caller.
 */
async function endLinks(
  tx: Transaction,
  where: SQL | undefined,
  by: CareLinkEndedBy,
  now: Date
): Promise<readonly { readonly id: string; readonly clientId: string; readonly professionalId: string }[]> {
  const ended = await tx
    .update(careLinks)
    .set({ endedAt: now, endedBy: by, status: 'ended', updatedAt: now })
    .where(and(where, inArray(careLinks.status, [...OPEN_STATUSES])))
    .returning({ id: careLinks.id, clientId: careLinks.clientId, professionalId: careLinks.professionalId });

  for (const link of ended) {
    await tx
      .update(targetOverrides)
      .set({ setByProfessionalId: null, updatedAt: now })
      .where(and(eq(targetOverrides.userId, link.clientId), eq(targetOverrides.setByProfessionalId, link.professionalId)));
  }

  return ended;
}

/**
 * Narrows every open link `where` names, inside `tx`, that still holds more than
 * the plan-only list — `consent_scope = 'plan'` and the health line off — and
 * answers how many. A badge gone is what calls it (`sweepBadgeLoss`,
 * `narrowLinksOf`): what the client consented to under that badge does not
 * outlive it, so a badge that comes back widens nothing until the client's own
 * `reconsent`. It leaves its own mark, `narrowed_at` — only on a row it
 * actually changes (a link already `plan` with the line off is not touched and
 * gets no date) — and never clears one; the acceptance's
 * `consentedAt`/`consentVersion` and the re-consent's columns stay, so the row
 * reads "accepted then, narrowed then, widened again then". No trail row is
 * written for the health line going off: the client did not do it.
 */
async function narrowLinks(tx: Transaction, where: SQL | undefined, now: Date): Promise<number> {
  const narrowed = await tx
    .update(careLinks)
    .set({ consentScope: 'plan', narrowedAt: now, sharesHealth: false, updatedAt: now })
    .where(and(where, inArray(careLinks.status, [...OPEN_STATUSES]), widerThanPlan))
    .returning({ id: careLinks.id });

  return narrowed.length;
}

/** Whether a link opens `full` now: its own consent, and the practitioner's badge read at `now`, inside `tx` (`linkScope`). */
async function opensFull(link: CareLink, now: Date, tx: Transaction): Promise<boolean> {
  return linkScope(link.consentScope, (await ProfessionalBadgeRepository.badgeOf(link.professionalId, now, tx)) !== null) === 'full';
}

/**
 * Writes a professional's `write` row into the transaction that makes the
 * change — handed by `CareController.withClient` to its callback, and called by
 * the repository that writes, inside its own transaction.
 */
export type RecordAccess = (tx: Transaction) => Promise<void>;

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on care: ${error.message}`);
  }

  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
