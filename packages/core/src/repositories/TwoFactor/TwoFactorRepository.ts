import { and, eq, isNotNull, isNull, like, lt, lte, or } from 'drizzle-orm';

import { database } from 'database';
import { twoFactor, user, verification } from 'database/schema/auth';
import { twoFactorRemovals } from 'database/schema/platform';

import { DatabaseOperationError } from 'core/entities/Error';

import type { RecordAudit } from '#repositories/Audit';

/**
 * How Better Auth's two-factor plugin names a trusted device's `verification`
 * row — the same prefix `UserRepository.forgetTrustedDevices` deletes by.
 */
const TRUSTED_DEVICE_PREFIX = 'trust-device-';

/** What a request found: written, with the account's address for the mail; or why it was not. */
export type RemovalRequest =
  | { readonly dueAt: Date; readonly email: string; readonly kind: 'requested' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'not_enabled' }
  | { readonly kind: 'pending' };

/**
 * The owner's removal of a lost second factor (PLAN 011 phase 4), and the
 * replay guard on authenticator codes. Every method names the account by the
 * id its caller resolved — an admin route's path (behind `AdminGuard`), the
 * account a correct code just proved, or a due row the cron read — and every
 * statement filters on it.
 */
export const TwoFactorRepository = {
  /**
   * Cancels the account's pending removal, if there is one, and writes the
   * caller's audit row in the same transaction. One guarded `UPDATE … WHERE
   * cancelled_at IS NULL RETURNING`: of two cancels at once, one finds the
   * row; and a cancel racing the cron's `DELETE` either lands first (and the
   * cron's re-checked `WHERE` skips the row) or finds nothing. Answers the
   * account's address, or null when nothing was pending.
   */
  async cancel(userId: string, now: Date, record: RecordAudit): Promise<{ readonly email: string } | null> {
    try {
      return await database().transaction(async tx => {
        const [row] = await tx
          .update(twoFactorRemovals)
          .set({ cancelledAt: now, updatedAt: now })
          .where(and(eq(twoFactorRemovals.userId, userId), isNull(twoFactorRemovals.cancelledAt)))
          .returning({ id: twoFactorRemovals.id });

        if (!row) {
          return null;
        }

        const [account] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);

        await record(tx);

        return account ? { email: account.email } : null;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Claims a 30-second TOTP step for the account: one guarded `UPDATE … WHERE
   * last_totp_step IS NULL OR last_totp_step < $step RETURNING`. Two requests
   * with the same code race on the row and only one gets it back; a code
   * from a step at or before the last accepted one gets nothing. Answers
   * whether this call claimed it.
   */
  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    try {
      const rows = await database()
        .update(twoFactor)
        .set({ lastTotpStep: step })
        .where(and(eq(twoFactor.userId, userId), or(isNull(twoFactor.lastTotpStep), lt(twoFactor.lastTotpStep, step))))
        .returning({ id: twoFactor.id });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** The accounts whose removal is due: requested, not cancelled, `due_at` at or before `now`. Only ids; `remove` re-checks each. */
  async due(now: Date): Promise<readonly string[]> {
    try {
      const rows = await database()
        .select({ userId: twoFactorRemovals.userId })
        .from(twoFactorRemovals)
        .where(and(isNull(twoFactorRemovals.cancelledAt), lte(twoFactorRemovals.dueAt, now)));

      return rows.map(row => row.userId);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Removes the account's second factor, if its removal is due, in one
   * transaction. The first statement deletes the request row **only if** it
   * is still pending and `due_at <= now` — that `WHERE`, not the caller's
   * list, is what keeps a factor from going sooner than its 48 hours or after
   * a cancel; a second run finds no row and does nothing. Then the
   * plugin's `two_factor` row goes, `two_factor_enabled` turns false, every
   * trusted device is forgotten, and `record` writes the audit row.
   *
   * When the account had already turned the factor off itself (no
   * `two_factor` row was there to delete), the request row still goes but
   * nothing else is said: no row, no mail. Answers the address when a
   * factor was removed, otherwise null.
   */
  async remove(userId: string, now: Date, record: RecordAudit): Promise<{ readonly email: string } | null> {
    try {
      return await database().transaction(async tx => {
        const [request] = await tx
          .delete(twoFactorRemovals)
          .where(and(eq(twoFactorRemovals.userId, userId), isNull(twoFactorRemovals.cancelledAt), lte(twoFactorRemovals.dueAt, now)))
          .returning({ id: twoFactorRemovals.id });

        if (!request) {
          return null;
        }

        const factors = await tx.delete(twoFactor).where(eq(twoFactor.userId, userId)).returning({ id: twoFactor.id });
        const [account] = await tx
          .update(user)
          .set({ twoFactorEnabled: false, updatedAt: now })
          .where(eq(user.id, userId))
          .returning({ email: user.email });

        await tx.delete(verification).where(and(eq(verification.value, userId), like(verification.identifier, `${TRUSTED_DEVICE_PREFIX}%`)));

        if (factors.length === 0 || !account) {
          return null;
        }

        await record(tx);

        return { email: account.email };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Writes the owner's request, 48 hours from now, and its audit row, in one
   * transaction. The account is read first (exists, factor on, its address);
   * then one `INSERT … ON CONFLICT (user_id) DO UPDATE … WHERE cancelled_at IS
   * NOT NULL RETURNING`: a cancelled row is reused, a pending one is left as
   * it was and nothing comes back. Two requests at once write one row and the
   * other answers `pending` — the UNIQUE is the check, not a read before.
   */
  async request(userId: string, requestedBy: string, now: Date, dueAt: Date, record: RecordAudit): Promise<RemovalRequest> {
    try {
      return await database().transaction(async tx => {
        const [account] = await tx
          .select({ email: user.email, twoFactorEnabled: user.twoFactorEnabled })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);

        if (!account) {
          return { kind: 'missing' } as const;
        }

        if (!account.twoFactorEnabled) {
          return { kind: 'not_enabled' } as const;
        }

        const [row] = await tx
          .insert(twoFactorRemovals)
          .values({ dueAt, requestedAt: now, requestedBy, userId })
          .onConflictDoUpdate({
            set: { cancelledAt: null, dueAt, requestedAt: now, requestedBy, updatedAt: now },
            setWhere: isNotNull(twoFactorRemovals.cancelledAt),
            target: twoFactorRemovals.userId
          })
          .returning({ dueAt: twoFactorRemovals.dueAt });

        if (!row) {
          return { kind: 'pending' } as const;
        }

        await record(tx);

        return { dueAt: row.dueAt, email: account.email, kind: 'requested' } as const;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

/** Driver messages can carry connection strings; nothing of them leaves. */
function wrap(_error: unknown): DatabaseOperationError {
  return new DatabaseOperationError();
}
