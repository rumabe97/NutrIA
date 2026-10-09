import { createHash, randomUUID } from 'node:crypto';

import { and, desc, eq, gt, inArray, like } from 'drizzle-orm';

import { database } from 'database';
import { user, verification } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

import type { SQL } from 'drizzle-orm';

/**
 * How Better Auth's `verification` table names a device cookie's row — the
 * table is its key-value store, trusted devices and the mail budget live there
 * too, rows expire by `expiresAt`, and the daily `/cron/sweep-verifications`
 * deletes the expired ones. The identifier carries the SHA-256 of the cookie's
 * token, never the token, and `value` is the account the cookie was earned
 * for. No table of its own, so no migration (PLAN 011 phase 7b).
 */
const SIGN_IN_DEVICE_PREFIX = 'sign-in-device:';

function identifierOf(token: string): string {
  return `${SIGN_IN_DEVICE_PREFIX}${createHash('sha256').update(token).digest('hex')}`;
}

/** Every device cookie of one account — what a change or a reset of its password ends. */
export function signInDevicesOf(userId: string): SQL | undefined {
  return and(eq(verification.value, userId), like(verification.identifier, `${SIGN_IN_DEVICE_PREFIX}%`));
}

/**
 * The device cookies' rows (PLAN 011 phase 7b). The account is always the one
 * a verified session or sign-in named, or the one the token itself names;
 * nothing here takes a user id from a request.
 */
export const SignInDeviceRepository = {
  /** Ends every device cookie of the account (a password change has its own transaction: `UserRepository.passwordChanged`). */
  async forgetAll(userId: string): Promise<number> {
    try {
      const rows = await database().delete(verification).where(signInDevicesOf(userId)).returning({ id: verification.id });

      return rows.length;
    } catch {
      throw new DatabaseOperationError();
    }
  },

  /**
   * A new device for the account, and the account's oldest ones past `keep`
   * gone, in one transaction — so a client that signs in over and over without
   * keeping the cookie cannot grow the table.
   */
  async issue(userId: string, token: string, expiresAt: Date, keep: number): Promise<void> {
    try {
      await database().transaction(async tx => {
        await tx.insert(verification).values({ id: randomUUID(), expiresAt, identifier: identifierOf(token), value: userId });

        const devices = await tx
          .select({ id: verification.id })
          .from(verification)
          .where(signInDevicesOf(userId))
          .orderBy(desc(verification.expiresAt), desc(verification.createdAt));
        const forgotten = devices.slice(keep).map(row => row.id);

        if (forgotten.length > 0) {
          await tx.delete(verification).where(inArray(verification.id, forgotten));
        }
      });
    } catch {
      throw new DatabaseOperationError();
    }
  },

  /**
   * The account's own cookie, still good, lives on: its end moves to
   * `expiresAt`. False when the token is unknown, expired or belongs to
   * another account — then the caller issues a new one.
   */
  async renew(userId: string, token: string, now: Date, expiresAt: Date): Promise<boolean> {
    try {
      const rows = await database()
        .update(verification)
        .set({ expiresAt })
        .where(and(eq(verification.identifier, identifierOf(token)), eq(verification.value, userId), gt(verification.expiresAt, now)))
        .returning({ id: verification.id });

      return rows.length > 0;
    } catch {
      throw new DatabaseOperationError();
    }
  },

  /**
   * The address of the account a token was earned for, or null when it is
   * unknown or past its time. A single read, and the address stays inside the
   * caller: it is compared to the one being signed in to, and never answered.
   */
  async whoseIs(token: string, now: Date): Promise<string | null> {
    try {
      const [row] = await database()
        .select({ email: user.email })
        .from(verification)
        .innerJoin(user, eq(user.id, verification.value))
        .where(and(eq(verification.identifier, identifierOf(token)), gt(verification.expiresAt, now)))
        .limit(1);

      return row?.email ?? null;
    } catch {
      throw new DatabaseOperationError();
    }
  }
};
