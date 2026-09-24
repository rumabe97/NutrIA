import { and, eq, exists, gt, inArray, lte, ne, or } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { careInvitations, careLinks } from 'database/schema/care';
import { professionals } from 'database/schema/professional';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';
import { careInvitationSchema, careLinkSchema } from 'core/entities/Care';

import type { AcceptInvitation, CareInvitation, CareLink, CareLinkEndedBy } from 'core/entities/Care';
import type { SQL } from 'drizzle-orm';

/** The statuses a link is still a link in. `ended` is history. */
const OPEN_STATUSES = ['active', 'paused'] as const;

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
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on care: ${error.message}`);
  }

  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
