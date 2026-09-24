import { and, asc, desc, eq, exists, gt, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ZodError } from 'zod';

import { database } from 'database';
import { careAccessLog, careInvitations, careLinks } from 'database/schema/care';
import { checkIns } from 'database/schema/progress';
import { mealPlans } from 'database/schema/plan';
import { onboardingState } from 'database/schema/profile';
import { professionals } from 'database/schema/professional';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';
import { careAccessEntrySchema, careInvitationSchema, careLinkSchema } from 'core/entities/Care';

import type {
  AcceptInvitation,
  CareAccessAction,
  CareAccessEntry,
  CareAccessKind,
  CareInvitation,
  CareLink,
  CareLinkEndedBy
} from 'core/entities/Care';
import type { SQL } from 'drizzle-orm';

/** The statuses a link is still a link in. `ended` is history. */
const OPEN_STATUSES = ['active', 'paused'] as const;

/** The client's side of a link, joined under its own name: `user` is also the professional's. */
const client = alias(user, 'client');

/**
 * An active link a professional reached through `CareController.withClient`,
 * with both names: the client's, for the page, and the professional's, for the
 * snapshot the client's trail keeps.
 */
export type ActiveLink = { readonly clientName: string; readonly link: CareLink; readonly professionalName: string };

/** One row of a professional's list, as stored: the link, the client's name, and where they are. */
export type RosterLink = {
  readonly clientName: string;
  /** The client's latest plan by version, whatever its status — the one a check-in is due on — or null. */
  readonly latestPlan: { readonly answered: boolean; readonly endDate: string } | null;
  readonly link: Pick<CareLink, 'consentedAt' | 'id' | 'reviewBeforePublish' | 'sharesHealth' | 'status'>;
  readonly onboarded: boolean;
  /** Whether a plan is under way. */
  readonly planActive: boolean;
  /**
   * Whether a plan is waiting for this professional's review (`0060`). Always
   * false until Phase 5 of project 004 adds the `pending_review` plan status:
   * the question cannot be asked of a status the database does not have yet.
   */
  readonly planPendingReview: boolean;
};

/** Everything on a professional's list: the live invitations, and the open links. */
export type Roster = { readonly invitations: readonly { readonly email: string; readonly expiresAt: Date }[]; readonly links: readonly RosterLink[] };

/** An invitation the session's account may read, with who sent it. */
export type OpenInvitation = { readonly expiresAt: Date; readonly professionalId: string; readonly professionalName: string };

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
  ({ readonly kind: 'created' } & LinkWithProfessional) | ({ readonly kind: 'exists' } & LinkWithProfessional) | { readonly kind: 'gone' };

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
   */
  async accept(clientId: string, email: string, tokenHash: string, answer: AcceptInvitation, now: Date): Promise<AcceptOutcome> {
    try {
      return await database().transaction(async (tx): Promise<AcceptOutcome> => {
        const [invitation] = await tx
          .select({ id: careInvitations.id, professionalId: careInvitations.professionalId, professionalName: user.name })
          .from(careInvitations)
          .innerJoin(professionals, eq(professionals.userId, careInvitations.professionalId))
          .innerJoin(user, eq(user.id, careInvitations.professionalId))
          .where(answerable(tokenHash, email, clientId, now))
          .limit(1)
          .for('update', { of: careInvitations });

        if (!invitation) {
          return { kind: 'gone' };
        }

        const [created] = await tx
          .insert(careLinks)
          .values({
            clientId,
            consentedAt: now,
            consentVersion: answer.consentVersion,
            professionalId: invitation.professionalId,
            sharesHealth: answer.sharesHealth
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
        .where(and(eq(careAccessLog.userId, clientId), older))
        .orderBy(desc(careAccessLog.createdAt), desc(careAccessLog.id))
        .limit(limit);

      return rows.map(row => careAccessEntrySchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The one question `CareController.withClient` asks (`0059`): is this link
   * the professional's, active, and are they still a professional? All of it
   * is the `WHERE` and the joins — the link id, `professionalId` (the
   * session's), `status = 'active'`, and an inner join on `professionals` so a
   * grant taken back closes the door on the next request. Every reason for
   * "no" is the same empty result.
   *
   * **The only query that turns a professional's session into another
   * account's id**: the client's id leaves this method inside the link, and
   * only `withClient` calls it.
   */
  async activeLink(professionalId: string, linkId: string): Promise<ActiveLink | null> {
    try {
      const [row] = await database()
        .select({ clientName: client.name, link: careLinks, professionalName: user.name })
        .from(careLinks)
        .innerJoin(professionals, eq(professionals.userId, careLinks.professionalId))
        .innerJoin(user, eq(user.id, careLinks.professionalId))
        .innerJoin(client, eq(client.id, careLinks.clientId))
        .where(and(eq(careLinks.id, linkId), eq(careLinks.professionalId, professionalId), eq(careLinks.status, 'active')))
        .limit(1);

      return row ? { clientName: row.clientName, link: careLinkSchema.parse(row.link), professionalName: row.professionalName } : null;
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
   */
  async end(userId: string, side: Extract<CareLinkEndedBy, 'client' | 'professional'>, linkId: string, now: Date): Promise<boolean> {
    try {
      const owner = side === 'client' ? careLinks.clientId : careLinks.professionalId;
      const rows = await database()
        .update(careLinks)
        .set({ endedAt: now, endedBy: side, status: 'ended', updatedAt: now })
        .where(and(eq(careLinks.id, linkId), eq(owner, userId), inArray(careLinks.status, [...OPEN_STATUSES])))
        .returning({ id: careLinks.id });

      return rows.length > 0;
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
   */
  async invite(professionalId: string, email: string, tokenHash: string, expiresAt: Date, now: Date): Promise<CareInvitation> {
    try {
      return await database().transaction(async tx => {
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

        return careInvitationSchema.parse(row);
      });
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
    entry: { readonly action: CareAccessAction; readonly kind: CareAccessKind; readonly professionalId: string; readonly professionalName: string },
    tx?: Transaction
  ): Promise<void> {
    try {
      await (tx ?? database()).insert(careAccessLog).values({ ...entry, userId: clientId });
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

      return row ?? null;
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
   * The latest plan is the highest version whatever its status, as
   * `CheckInController.status` reads it, so "check-in due" here and on the
   * client's own screen are the same fact. Phase 5 (`0060`) must teach this
   * read the `pending_review` status, as it does the four named in `0060`.
   */
  async roster(professionalId: string, now: Date): Promise<Roster> {
    try {
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

          return await rosterOf(db, professionalId, now);
        },
        { isolationLevel: 'repeatable read' }
      );
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

/**
 * What `roster` reads, inside its transaction. Only links whose grant stands:
 * the join on `professionals` is the same second line `activeLink` keeps.
 */
async function rosterOf(db: Transaction, professionalId: string, now: Date): Promise<Roster> {
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
        onboarded: sql<boolean>`${onboardingState.completedAt} is not null`,
        planActive: sql<boolean>`${careLinks.status} = 'active' and ${exists(
          db
            .select({ id: mealPlans.id })
            .from(mealPlans)
            .where(and(eq(mealPlans.userId, careLinks.clientId), eq(mealPlans.status, 'active')))
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
        linkId: careLinks.id
      })
      .from(mealPlans)
      .innerJoin(careLinks, eq(careLinks.clientId, mealPlans.userId))
      .where(and(eq(careLinks.professionalId, professionalId), eq(careLinks.status, 'active')))
      .orderBy(mealPlans.userId, desc(mealPlans.version))
  ]);

  return {
    invitations,
    links: links.map(row => ({
      clientName: row.clientName,
      latestPlan: latestOf(latest, row.id),
      link: {
        id: row.id,
        consentedAt: row.consentedAt,
        reviewBeforePublish: row.reviewBeforePublish,
        sharesHealth: row.sharesHealth,
        status: row.status
      },
      onboarded: row.onboarded,
      planActive: row.planActive,
      planPendingReview: false
    }))
  };
}

/** The latest plan behind one link, from the per-client rows `roster` read. */
function latestOf(
  rows: readonly { readonly answered: boolean; readonly endDate: string; readonly linkId: string }[],
  linkId: string
): RosterLink['latestPlan'] {
  const row = rows.find(candidate => candidate.linkId === linkId);

  return row ? { answered: row.answered, endDate: row.endDate } : null;
}

type Transaction = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

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
