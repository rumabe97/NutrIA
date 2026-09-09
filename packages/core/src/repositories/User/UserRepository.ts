import { eq } from 'drizzle-orm';
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

  /**
   * Opens the account (0017): the one write this repository makes to a table
   * Better Auth owns, because it is the switch the owner throws by hand today
   * and an admin screen will throw tomorrow. True when a row was updated.
   */
  async markEmailVerified(email: string): Promise<boolean> {
    try {
      const rows = await database().update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.email, email)).returning({ id: user.id });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on user: ${error.message}`);}

  return new DatabaseOperationError();
}
