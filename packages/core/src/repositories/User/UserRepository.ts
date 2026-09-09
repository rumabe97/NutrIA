import { eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';
import { userSchema } from 'core/entities/User';
import type { User } from 'core/entities/User';

/**
 * Reads the account row. Writes are Better Auth's job — it owns `user`,
 * `session`, `account` and `verification`, including sign-up, password hashing,
 * email verification and deletion. Inserting here would create a row Better
 * Auth cannot authenticate.
 *
 * Method pattern used by every repository in this package:
 *   1. `database()` for the Drizzle instance
 *   2. run the query, always filtering by the owner where the table is user-scoped
 *   3. parse the row with its Zod schema — drift surfaces here, not three layers up
 *   4. wrap failures: ZodError → DatabaseOperationError with context; anything
 *      else → a bare DatabaseOperationError, because driver messages can carry
 *      connection strings and must never reach a response
 */
export const UserRepository = {
  /**
   * Opens the account (`0017`, `0030`): the one write this repository makes to a
   * table Better Auth owns, because it is the owner's decision and nothing in
   * Better Auth models it. By id from the admin screen, by email from the
   * runbook and the tests. Returns the address opened, or null if there was no
   * such account.
   *
   * Deliberately does **not** touch `emailVerified`: that says the address is
   * real and only the person holding it can prove that.
   */
  async activate(match: { readonly id?: string; readonly email?: string; }): Promise<{ readonly email: string } | null> {
    try {
      const where = match.id === undefined ? eq(user.email, match.email ?? '') : eq(user.id, match.id);
      const rows = await database()
        .update(user)
        .set({ activatedAt: new Date(), updatedAt: new Date() })
        .where(where)
        .returning({ email: user.email });

      return rows[0] ?? null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const [row] = await database().select().from(user).where(eq(user.email, email)).limit(1);

      return row ? userSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findById(id: string): Promise<User | undefined> {
    try {
      const [row] = await database().select().from(user).where(eq(user.id, id)).limit(1);

      return row ? userSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Accounts still waiting for the owner, oldest first — the queue the admin screen shows. */
  async findWaiting(limit: number): Promise<readonly { readonly id: string; readonly createdAt: Date; readonly email: string; readonly emailVerified: boolean; }[]> {
    try {
      return await database()
        .select({ id: user.id, createdAt: user.createdAt, email: user.email, emailVerified: user.emailVerified })
        .from(user)
        .where(isNull(user.activatedAt))
        .orderBy(user.createdAt)
        .limit(limit);
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on user: ${error.message}`);}

  return new DatabaseOperationError();
}
