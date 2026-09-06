import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { users } from 'database/schema/users';

import { DatabaseOperationError } from 'core/entities/Error';
import { userSchema } from 'core/entities/User';
import type { CreateUser, User } from 'core/entities/User';

// delete is intentionally absent. In a Supabase app, user deletion goes through
// the Supabase auth admin API (supabase.auth.admin.deleteUser(id)), which cascades
// to all related records via foreign key constraints. Deleting from the users table
// directly would leave orphaned records in auth.users and break authentication.

// All UserRepository methods use `admin` deliberately:
//
//   - `findByEmail` / `create` are part of the sign-up flow, which runs before the
//     user has a JWT — there's nothing for `rls()` to scope against.
//   - `findById` is used both for self-lookups by an authenticated user AND for
//     cross-user lookups inside controller pre-checks (e.g. ProfileController
//     verifying "the user this profile is being created for exists"). The latter
//     requires bypassing the schema's "users can read their own record" RLS policy.
//
// The controller layer (and ultimately the app boundary — server actions, route
// handlers) is responsible for verifying the caller is authorised to act on a
// given user id. RLS on the `users` table is a belt-and-suspenders defence for
// any direct database access that ever sneaks past `admin`; it is not the
// primary control on this repository's reads.
//
// Standard method pattern:
//   1. Call database() to get the Drizzle instance
//   2. Run the query against `admin`
//   3. Parse the raw row with userSchema.parse() — Zod catches schema drift immediately
//   4. Wrap errors: ZodError → DatabaseOperationError with context; anything else → generic DatabaseOperationError
export const UserRepository = {
  async create(input: CreateUser): Promise<User> {
    try {
      const { admin } = await database();
      const [row] = await admin.insert(users).values(input).returning();

      return userSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on users: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  },

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const { admin } = await database();
      const [row] = await admin.select().from(users).where(eq(users.email, email)).limit(1);

      if (!row) {
        return undefined;
      }

      return userSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on users: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  },

  async findById(id: string): Promise<User | undefined> {
    try {
      const { admin } = await database();
      const [row] = await admin.select().from(users).where(eq(users.id, id)).limit(1);

      if (!row) {
        return undefined;
      }

      return userSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on users: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  }
};
