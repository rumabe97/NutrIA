import { desc, eq, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { careInvitations, careLinks } from 'database/schema/care';
import { professionals } from 'database/schema/professional';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';
import { professionalSchema } from 'core/entities/Professional';

import type { Professional } from 'core/entities/Professional';

/**
 * One professional on the owner's list: the account and its grant, and nothing
 * about anybody else (`0028`). The address is joined in because the owner
 * grants by account and must be able to tell which one they granted.
 */
export type ProfessionalListRow = {
  readonly collegiateNumber: string;
  readonly email: string;
  readonly grantedAt: Date;
  readonly includedClients: number;
  readonly links: LinkCountRow;
  readonly practiceOpen: boolean;
  readonly userId: string;
};

/** How many of one professional's links are in each status: counts, never a client. */
export type LinkCountRow = { readonly active: number; readonly ended: number; readonly paused: number };

/** Links of one status, counted over the joined rows; a professional with none counts zero. */
function linksIn(status: 'active' | 'ended' | 'paused') {
  return sql<number>`count(${careLinks.id}) filter (where ${careLinks.status} = ${status})`.mapWith(Number);
}

export const ProfessionalRepository = {
  /**
   * The professional accepts their agreement at `version` (`docs/legal/textos/01`).
   *
   * One guarded `UPDATE` by the session's id: no row, no grant, and `null`. The
   * date is kept when this version was already accepted, so a second click does
   * not move the moment the acceptance can be shown to have happened.
   */
  async acceptAgreement(userId: string, version: string, now: Date): Promise<Professional | null> {
    try {
      const [row] = await database()
        .update(professionals)
        .set({
          agreementAcceptedAt: sql`case when ${professionals.agreementVersion} = ${version} then ${professionals.agreementAcceptedAt} else ${now} end`,
          agreementVersion: version,
          updatedAt: now
        })
        .where(eq(professionals.userId, userId))
        .returning();

      return row ? professionalSchema.parse(row) : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The professional's own row, by the session's id.
   *
   * `userId` is the ownership boundary as everywhere else — here it is also
   * the question: is this account a professional at all. No row, `null`.
   */
  async find(userId: string): Promise<Professional | null> {
    try {
      const [row] = await database().select().from(professionals).where(eq(professionals.userId, userId)).limit(1);

      return row ? professionalSchema.parse(row) : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The owner's act (`0059`): makes an account a professional, or records the
   * act again on one that already is.
   *
   * An upsert on `user_id` rather than a read-then-insert, so two clicks fired
   * together cannot both land — the UNIQUE constraint is the check. Granting
   * again rewrites the number and the date: the row records the owner's latest
   * act, and correcting a mistyped number should not need a revocation first.
   * `practiceOpen` and `includedClients` are deliberately not touched — they
   * are billing's to write (`0061`), and a re-grant must not close a practice.
   */
  async grant(userId: string, collegiateNumber: string, grantedBy: string): Promise<Professional> {
    try {
      const grantedAt = new Date();
      const [row] = await database()
        .insert(professionals)
        .values({ collegiateNumber, grantedAt, grantedBy, userId })
        .onConflictDoUpdate({ set: { collegiateNumber, grantedAt, grantedBy, updatedAt: grantedAt }, target: professionals.userId })
        .returning();

      return professionalSchema.parse(row);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One professional's links, counted per status — for the grant's answer,
   * which is a row of the owner's list. Only the status column is read.
   */
  async linkCounts(professionalId: string): Promise<LinkCountRow> {
    try {
      const [row] = await database()
        .select({ active: linksIn('active'), ended: linksIn('ended'), paused: linksIn('paused') })
        .from(careLinks)
        .where(eq(careLinks.professionalId, professionalId));

      return row ?? { active: 0, ended: 0, paused: 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every professional, most recently granted first, with their links counted
   * per status.
   *
   * Reads for the owner's own screen and nothing about a client (`0028`): the
   * links are joined only to be counted, and no column of theirs but the status
   * is read — not a client's id, not a name, not an address.
   */
  async list(): Promise<readonly ProfessionalListRow[]> {
    try {
      const rows = await database()
        .select({
          active: linksIn('active'),
          collegiateNumber: professionals.collegiateNumber,
          email: user.email,
          ended: linksIn('ended'),
          grantedAt: professionals.grantedAt,
          includedClients: professionals.includedClients,
          paused: linksIn('paused'),
          practiceOpen: professionals.practiceOpen,
          userId: professionals.userId
        })
        .from(professionals)
        .innerJoin(user, eq(user.id, professionals.userId))
        .leftJoin(careLinks, eq(careLinks.professionalId, professionals.userId))
        .groupBy(professionals.id, user.id)
        .orderBy(desc(professionals.grantedAt));

      return rows.map(({ active, ended, paused, ...row }) => ({ ...row, links: { active, ended, paused } }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Takes the grant back. Returns false when the account was not a professional. */
  async revoke(userId: string): Promise<boolean> {
    try {
      // Their unanswered invitations go with the grant: nobody can answer them any more, and each holds an address somebody typed.
      return await database().transaction(async tx => {
        const rows = await tx.delete(professionals).where(eq(professionals.userId, userId)).returning({ id: professionals.id });
        await tx.delete(careInvitations).where(eq(careInvitations.professionalId, userId));

        return rows.length > 0;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on professionals: ${error.message}`);
  }

  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
