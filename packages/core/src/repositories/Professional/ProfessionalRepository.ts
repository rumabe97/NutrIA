import { desc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
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
  readonly practiceOpen: boolean;
  readonly userId: string;
};

export const ProfessionalRepository = {
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
   * Every professional, most recently granted first.
   *
   * Reads for the owner's own screen and nothing about a client: no link is
   * joined here, and none will be by name — a count per status is Phase 2's
   * addition, and it stays a count.
   */
  async list(): Promise<readonly ProfessionalListRow[]> {
    try {
      return await database()
        .select({
          collegiateNumber: professionals.collegiateNumber,
          email: user.email,
          grantedAt: professionals.grantedAt,
          includedClients: professionals.includedClients,
          practiceOpen: professionals.practiceOpen,
          userId: professionals.userId
        })
        .from(professionals)
        .innerJoin(user, eq(user.id, professionals.userId))
        .orderBy(desc(professionals.grantedAt));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Takes the grant back. Returns false when the account was not a professional. */
  async revoke(userId: string): Promise<boolean> {
    try {
      const rows = await database().delete(professionals).where(eq(professionals.userId, userId)).returning({ id: professionals.id });

      return rows.length > 0;
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
