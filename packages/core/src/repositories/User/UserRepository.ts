import { count, desc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';
import { userSchema } from 'core/entities/User';
import type { User, UserTier } from 'core/entities/User';

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
  async activate(match: { readonly id?: string; readonly email?: string }): Promise<{ readonly email: string } | null> {
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

  /**
   * Marks the address confirmed — the owner vouching for it, not the person
   * proving it.
   *
   * The product's own path is the verification link, and nothing here is
   * reachable over HTTP. This exists for the two places that always needed it:
   * the runbook's statement for somebody who cannot receive the mail, and the
   * suites, where no mail is sent at all.
   */
  async confirmAddress(email: string): Promise<boolean> {
    try {
      const rows = await database()
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.email, email))
        .returning({ email: user.email });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A page of accounts, **newest first**, and how many there are in total.
   *
   * Newest first because the useful end is the recent one: the account waiting
   * to be opened is the one that just signed up. Oldest-first with a cap meant
   * that past a few hundred accounts the screen showed the founders and lost
   * everybody who needed something.
   *
   * Address, dates and role only. No profile, no plan, no answers: an admin
   * surface that can read what people eat is how one becomes a way to read
   * people's health data (`0028`), and none of it helps decide whether to open
   * an account.
   */
  async findAll(
    limit: number,
    offset: number
  ): Promise<{
    readonly rows: readonly {
      readonly id: string;
      readonly activatedAt: Date | null;
      readonly createdAt: Date;
      readonly email: string;
      readonly emailVerified: boolean;
      readonly role: 'admin' | 'user';
      readonly tier: UserTier;
    }[];
    readonly total: number;
  }> {
    try {
      const db = database();
      const [rows, counted] = await Promise.all([
        db
          .select({
            id: user.id,
            activatedAt: user.activatedAt,
            createdAt: user.createdAt,
            email: user.email,
            emailVerified: user.emailVerified,
            role: user.role,
            tier: user.tier
          })
          .from(user)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ n: count() }).from(user)
      ]);

      return { rows, total: counted[0]?.n ?? 0 };
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

  /**
   * Makes an account an administrator.
   *
   * The runbook's other statement (`update "user" set role = 'admin' …`), and
   * nothing over HTTP reaches it: there is no route that grants a role, because
   * a product where an admin can be created by a request is a product where one
   * bug creates an admin.
   */
  async grantAdmin(email: string): Promise<boolean> {
    try {
      const rows = await database()
        .update(user)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(user.email, email))
        .returning({ email: user.email });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Moves an account between tiers (`0042`).
   *
   * The owner's decision, like activation, and the second write this repository
   * makes to a table Better Auth owns. Returns the address moved, or null when
   * there was no such account — the caller turns that into the same 404 every
   * other denial gives.
   */
  async setTier(id: string, tier: UserTier): Promise<{ readonly email: string } | null> {
    try {
      const [row] = await database().update(user).set({ tier, updatedAt: new Date() }).where(eq(user.id, id)).returning({ email: user.email });

      return row ?? null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * What this account may spend, as the database has it.
   *
   * One column rather than the whole row: this is read on the path that decides
   * whether a model call is allowed, and nothing else about the person matters
   * there. An account that does not exist reads as `free`, which is the answer
   * that grants the least.
   */
  async tierOf(id: string): Promise<UserTier> {
    try {
      const [row] = await database().select({ tier: user.tier }).from(user).where(eq(user.id, id)).limit(1);

      return row?.tier ?? 'free';
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on user: ${error.message}`);
  }

  return new DatabaseOperationError();
}
