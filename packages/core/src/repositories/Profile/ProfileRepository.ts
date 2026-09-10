import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { cuisinePreferences, goals, profiles, targetOverrides, userDietaryPatterns, userPreferences } from 'database/schema/profile';
import { foodPreferences } from 'database/schema/food';

import { DatabaseOperationError } from 'core/entities/Error';
import { goalSchema, preferencesSchema, profileSchema } from 'core/entities/Profile';
import { targetOverrideSchema } from 'core/entities/Nutrition';
import type { Goal, Preferences, Profile, UpdateGoal, UpdatePreferences, UpdateProfile } from 'core/entities/Profile';
import type { TargetOverride, UpdateTargetOverride } from 'core/entities/Nutrition';

/**
 * Every method takes `userId` as its first argument and every query filters on
 * it. That is the ownership boundary — there is no row-level security behind
 * this package, so a query without the filter is a data leak, not a slow query.
 * `userId` always comes from the verified session, never from a request body.
 */
export const ProfileRepository = {
  async findActiveGoal(userId: string): Promise<Goal | undefined> {
    try {
      const [row] = await database()
        .select()
        .from(goals)
        .where(and(eq(goals.userId, userId), isNull(goals.archivedAt)))
        .limit(1);

      return row ? goalSchema.parse(toNumbers(row, ['paceKgPerWeek', 'startingWeightKg', 'targetWeightKg'])) : undefined;
    } catch (error: unknown) {
      throw wrap(error, 'goals');
    }
  },

  async findByUserId(userId: string): Promise<Profile | undefined> {
    try {
      const [row] = await database().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

      return row ? profileSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error, 'profiles');
    }
  },

  async findCuisines(userId: string): Promise<readonly string[]> {
    try {
      const rows = await database()
        .select({ cuisine: cuisinePreferences.cuisine })
        .from(cuisinePreferences)
        .where(and(eq(cuisinePreferences.userId, userId), eq(cuisinePreferences.sentiment, 'liked')));

      return rows.map(row => row.cuisine);
    } catch (error: unknown) {
      throw wrap(error, 'cuisine_preferences');
    }
  },

  async findDietaryPatterns(userId: string): Promise<readonly string[]> {
    try {
      const rows = await database()
        .select({ pattern: userDietaryPatterns.pattern })
        .from(userDietaryPatterns)
        .where(eq(userDietaryPatterns.userId, userId));

      return rows.map(row => row.pattern);
    } catch (error: unknown) {
      throw wrap(error, 'user_dietary_patterns');
    }
  },

  async findFoodPreferences(userId: string): Promise<readonly { ingredientId: string | null; label: string; sentiment: 'disliked' | 'liked' }[]> {
    try {
      return await database()
        .select({ ingredientId: foodPreferences.ingredientId, label: foodPreferences.label, sentiment: foodPreferences.sentiment })
        .from(foodPreferences)
        .where(eq(foodPreferences.userId, userId));
    } catch (error: unknown) {
      throw wrap(error, 'food_preferences');
    }
  },

  async findPreferences(userId: string): Promise<Preferences | undefined> {
    try {
      const [row] = await database().select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

      return row ? preferencesSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error, 'user_preferences');
    }
  },

  async findTargetOverride(userId: string): Promise<TargetOverride | undefined> {
    try {
      const [row] = await database().select().from(targetOverrides).where(eq(targetOverrides.userId, userId)).limit(1);

      return row ? targetOverrideSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error, 'target_overrides');
    }
  },

  async setCuisines(userId: string, cuisines: readonly string[]): Promise<void> {
    try {
      const db = database();

      await db.delete(cuisinePreferences).where(eq(cuisinePreferences.userId, userId));

      if (cuisines.length > 0) {
        await db.insert(cuisinePreferences).values(cuisines.map(cuisine => ({ cuisine, sentiment: 'liked' as const, userId })));
      }
    } catch (error: unknown) {
      throw wrap(error, 'cuisine_preferences');
    }
  },

  /** Replace-all: the client sends the complete set, so a removed pattern actually disappears. */
  async setDietaryPatterns(userId: string, patterns: readonly string[]): Promise<void> {
    try {
      const db = database();

      await db.delete(userDietaryPatterns).where(eq(userDietaryPatterns.userId, userId));

      if (patterns.length > 0) {
        await db.insert(userDietaryPatterns).values(patterns.map(pattern => ({ pattern: pattern as 'omnivore', userId })));
      }
    } catch (error: unknown) {
      throw wrap(error, 'user_dietary_patterns');
    }
  },

  async setFoodPreferences(
    userId: string,
    preferences: readonly { ingredientId?: string | null; label: string; sentiment: 'disliked' | 'liked' }[]
  ): Promise<void> {
    try {
      const db = database();

      await db.delete(foodPreferences).where(eq(foodPreferences.userId, userId));

      if (preferences.length > 0) {
        await db
          .insert(foodPreferences)
          .values(preferences.map(p => ({ ingredientId: p.ingredientId ?? null, label: p.label, sentiment: p.sentiment, userId })));
      }
    } catch (error: unknown) {
      throw wrap(error, 'food_preferences');
    }
  },

  /** Writes when the tour was shown, or clears it so it is offered again (`0038`). */
  async setTourSeen(userId: string, seen: boolean): Promise<void> {
    try {
      await database()
        .update(profiles)
        .set({ tourSeenAt: seen ? new Date() : null, updatedAt: new Date() })
        .where(eq(profiles.userId, userId));
    } catch (error: unknown) {
      throw wrap(error, 'profiles');
    }
  },

  /** Insert-or-update, because onboarding writes the profile one step at a time. */
  async upsert(userId: string, input: UpdateProfile): Promise<Profile> {
    try {
      const [row] = await database()
        .insert(profiles)
        .values({ ...input, userId })
        .onConflictDoUpdate({ set: input, target: profiles.userId })
        .returning();

      return profileSchema.parse(row);
    } catch (error: unknown) {
      throw wrap(error, 'profiles');
    }
  },

  async upsertGoal(userId: string, input: UpdateGoal): Promise<Goal> {
    try {
      const db = database();
      const values = {
        customGoal: input.customGoal ?? null,
        paceKgPerWeek: toNumeric(input.paceKgPerWeek),
        startingWeightKg: toNumeric(input.startingWeightKg),
        targetWeightKg: toNumeric(input.targetWeightKg),
        type: input.type
      };

      const [existing] = await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.userId, userId), isNull(goals.archivedAt)))
        .limit(1);

      const [row] = existing
        ? await db.update(goals).set(values).where(eq(goals.id, existing.id)).returning()
        : await db
            .insert(goals)
            .values({ ...values, userId })
            .returning();

      return goalSchema.parse(toNumbers(row, ['paceKgPerWeek', 'startingWeightKg', 'targetWeightKg']));
    } catch (error: unknown) {
      throw wrap(error, 'goals');
    }
  },

  async upsertPreferences(userId: string, input: UpdatePreferences): Promise<Preferences> {
    try {
      const [row] = await database()
        .insert(userPreferences)
        .values({ ...input, userId })
        .onConflictDoUpdate({ set: input, target: userPreferences.userId })
        .returning();

      return preferencesSchema.parse(row);
    } catch (error: unknown) {
      throw wrap(error, 'user_preferences');
    }
  },

  /**
   * Writes only the fields the caller named.
   *
   * A field left out of `input` is untouched; a field sent as `null` is cleared
   * back to the computed value. That distinction is the whole contract of this
   * table, so the upsert must not fill in defaults for absent keys.
   */
  async upsertTargetOverride(userId: string, input: UpdateTargetOverride): Promise<TargetOverride> {
    try {
      const values = { ...input, overriddenAt: new Date() };
      const [row] = await database()
        .insert(targetOverrides)
        .values({ ...values, userId })
        .onConflictDoUpdate({ set: values, target: targetOverrides.userId })
        .returning();

      return targetOverrideSchema.parse(row);
    } catch (error: unknown) {
      throw wrap(error, 'target_overrides');
    }
  }
};

/** Drizzle returns `numeric` columns as strings to avoid float loss; entities want numbers. */
function toNumbers<T extends Record<string, unknown>>(row: T | undefined, keys: readonly string[]): T | undefined {
  if (!row) {
    return row;
  }

  const parsed: Record<string, unknown> = { ...row };

  for (const key of keys) {
    const value = parsed[key];
    parsed[key] = typeof value === 'string' ? Number(value) : value;
  }

  return parsed as T;
}

function toNumeric(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

function wrap(error: unknown, table: string): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on ${table}: ${error.message}`);
  }

  return new DatabaseOperationError();
}
