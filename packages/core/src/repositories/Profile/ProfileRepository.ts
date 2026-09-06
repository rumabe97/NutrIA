import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { profiles } from 'database/schema/profiles';

import { DatabaseOperationError } from 'core/entities/Error';
import { profileSchema } from 'core/entities/Profile';
import type { CreateProfile, Profile, UpdateProfile } from 'core/entities/Profile';

// ProfileRepository — picks between `rls` and `admin` per method based on intent:
//
//   rls()  — runs the query inside a transaction with the caller's JWT set as
//            Postgres session context. The RLS policies on the `profiles` table
//            (`Users can read/update/delete their own profile`) then fire and
//            enforce ownership at the database level. Use for owner-scoped reads
//            and for any write that touches a row the user is supposed to own —
//            even if the controller thinks it's already verified ownership, RLS
//            is the second line of defense.
//
//   admin  — bypasses RLS. Use only for genuinely cross-user operations that the
//            current owner-scoped RLS policies would block (uniqueness checks,
//            admin moderation, server-side seeding).
//
// Picking the wrong one is a real bug: using `admin` where RLS should fire silently
// hands cross-user access to anyone calling the repo; using `rls` where a cross-user
// read is needed (e.g. checking if a username is taken) silently returns "no rows"
// and the business rule appears broken.
export const ProfileRepository = {
  async create(input: CreateProfile): Promise<Profile> {
    // RLS: insert policy is "Users can create their own profile" where
    // `userId = auth.uid()`. If a malicious caller passes a userId other than
    // the authenticated user's, Postgres rejects the insert.
    try {
      const { rls } = await database();
      const row = await rls(async tx => {
        const [inserted] = await tx.insert(profiles).values(input).returning();

        return inserted;
      });

      return profileSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on profiles: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  },

  async delete(id: string): Promise<void> {
    // RLS: delete policy is "Users can delete their own profile". Same enforcement.
    try {
      const { rls } = await database();
      await rls(async tx => {
        await tx.delete(profiles).where(eq(profiles.id, id));
      });
    } catch {
      throw new DatabaseOperationError();
    }
  },

  async findById(id: string): Promise<Profile | undefined> {
    // RLS: select policy is "Users can read their own profile" — non-owners get
    // back zero rows, which we surface as `undefined` exactly like a missing row.
    try {
      const { rls } = await database();
      const row = await rls(async tx => {
        const [first] = await tx.select().from(profiles).where(eq(profiles.id, id)).limit(1);

        return first;
      });

      if (!row) {
        return undefined;
      }

      return profileSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on profiles: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  },

  async findByUserId(userId: string): Promise<Profile | undefined> {
    // RLS: same as above — owner-only read scoped to the caller.
    try {
      const { rls } = await database();
      const row = await rls(async tx => {
        const [first] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

        return first;
      });

      if (!row) {
        return undefined;
      }

      return profileSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on profiles: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  },

  async findByUsername(username: string): Promise<Profile | undefined> {
    // admin: cross-user uniqueness check (called by the controller before a
    // create/update to detect name collisions). RLS would block reads of other
    // users' rows and make every name appear available.
    try {
      const { admin } = await database();
      const [row] = await admin.select().from(profiles).where(eq(profiles.username, username)).limit(1);

      if (!row) {
        return undefined;
      }

      return profileSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on profiles: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  },

  async update(id: string, input: UpdateProfile): Promise<Profile | undefined> {
    // RLS: update policy is "Users can update their own profile". A caller updating
    // a row they don't own gets back zero affected rows — same shape as "row missing".
    // Return `undefined` for both and let the controller decide the business semantics
    // (NotFoundError, etc.). Matches the findById pattern; keeps business errors out
    // of the repository layer.
    try {
      const { rls } = await database();
      const row = await rls(async tx => {
        const [updated] = await tx
          .update(profiles)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(profiles.id, id))
          .returning();

        return updated;
      });

      if (!row) {
        return undefined;
      }

      return profileSchema.parse(row);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new DatabaseOperationError(`Schema mismatch on profiles: ${error.message}`);
      }

      throw new DatabaseOperationError();
    }
  }
};
