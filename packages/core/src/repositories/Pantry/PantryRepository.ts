import { and, asc, eq, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { pantryItems } from 'database/schema/pantry';

import { ConflictError, DatabaseOperationError, InputParseError } from 'core/entities/Error';
import { pantryItemSchema } from 'core/entities/Pantry';

import type { PantryItem } from 'core/entities/Pantry';

/** As `KitchenRepository` and `FixedMealRepository`: enough turns at the lock for this account's double submit, retry and burst to each get one. */
const LOCK_ATTEMPTS = 8;

/** The row a write resolved to, as the caller hands it over — the resolution is the controller's. */
export type ResolvedPantryEntry = {
  readonly grams: number | null;
  readonly ingredientId: string | null;
  readonly label: string;
  readonly normalisedLabel: string;
  readonly unit: PantryItem['unit'];
};

const COLUMNS = {
  id: pantryItems.id,
  grams: pantryItems.grams,
  ingredientId: pantryItems.ingredientId,
  label: pantryItems.label,
  unit: pantryItems.unit
};

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function backoff(attempt: number): number {
  const base = Math.min(20 * 2 ** (attempt - 1), 250);

  return base + Math.random() * base;
}

export const PantryRepository = {
  /**
   * Adds or re-states one entry, inside the same lock that re-reads what this
   * account already said.
   *
   * `allow` is handed **the other entries** — the one this write replaces left
   * out, since re-stating something already in the cupboard is never the
   * sixty-first thing — and throws if the write would break the bound. It is
   * the controller's rule and the controller's error: a repository that knew
   * what `MAX_PANTRY_ITEMS` was would be a second place to change it.
   *
   * Why a lock for a bound of sixty. "Count the rows, then insert" is two
   * statements against two snapshots: under READ COMMITTED two requests fired
   * together — two tabs, a double tap, a retry — both count fifty-nine and both
   * insert, and the account ends with sixty-one. It is the same shape a security
   * scan found in `EventController.add` on 2026-09-22 and the reason
   * `FixedMealRepository.createWithinQuota` exists. The two partial unique
   * indexes are **not** this defence: they stop the same thing being named
   * twice and say nothing about sixty entries racing past a count.
   *
   * `try` and not the blocking form, for the reason written in
   * `FixedMealRepository`: a blocking lock as a transaction's first statement
   * pins a pooled connection for the whole wait, so ten of one account's
   * requests would deny every other account.
   *
   * **Re-stating an entry writes the amount over the old one** rather than
   * refusing or doubling it: there is no route to edit a cupboard, so typing a
   * thing again is how somebody says how much of it they have. The matching row
   * is found inside the lock, which is why it cannot race; the unique indexes
   * stand behind it for anything that ever skips this path.
   *
   * **And a word the catalogue has since learned collapses onto itself.** An
   * entry that now resolves may find the same word standing unresolved from
   * before — a state both partial indexes allow — and takes it in rather than
   * growing a second row beside it.
   */
  async add(
    userId: string,
    entry: ResolvedPantryEntry,
    allow: (others: readonly PantryItem[]) => Promise<void> | void
  ): Promise<readonly PantryItem[]> {
    try {
      for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await wait(backoff(attempt));
        }

        const written = await database().transaction(async tx => {
          const [lock] = await tx.execute<{ held: boolean }>(
            sql`select pg_try_advisory_xact_lock(hashtext(${'pantry_items'}), hashtext(${userId})) as held`
          );

          if (!lock?.held) {
            return undefined;
          }

          const standing = await tx
            .select({ ...COLUMNS, normalisedLabel: pantryItems.normalisedLabel })
            .from(pantryItems)
            .where(eq(pantryItems.userId, userId))
            .orderBy(asc(pantryItems.createdAt));

          // The same thing twice is the row it resolved to, or — for an entry
          // the catalogue has no answer for — the same normalised word. Exactly
          // the two partial unique indexes, asked in the same order.
          const already = standing.find(row =>
            entry.ingredientId === null
              ? row.ingredientId === null && row.normalisedLabel === entry.normalisedLabel
              : row.ingredientId === entry.ingredientId
          );

          // The same word may also be standing here **unresolved**, from a day
          // when the catalogue had no answer for it. Neither partial index
          // forbids that pair — one holds the resolved rows, the other the
          // unresolved ones — so left alone the cupboard shows the word twice,
          // spends two of its sixty, and phase 2 reads a doubled saving off it.
          // The twin is taken in rather than left: where the resolved row
          // exists it stays and the twin goes, and where it does not the twin
          // becomes the resolved row in place, keeping the order it was typed
          // in. It is done this way round because updating the *twin* while a
          // resolved row stood would hand `pantry_items_one_per_ingredient` two
          // rows for one ingredient.
          const twin =
            entry.ingredientId === null
              ? undefined
              : standing.find(row => row.ingredientId === null && row.normalisedLabel === entry.normalisedLabel);

          const target = already ?? twin;
          const spent = new Set([already?.id, twin?.id]);

          await allow(standing.filter(row => !spent.has(row.id)).map(row => parse(row)));

          if (target) {
            await tx
              .update(pantryItems)
              .set({
                grams: amount(entry.grams),
                // Written on every update, not only the twin's: on the resolved
                // row it is the value it already held, and leaving it out would
                // make the one case that needs it the exception.
                ingredientId: entry.ingredientId,
                label: entry.label,
                normalisedLabel: entry.normalisedLabel,
                unit: entry.unit,
                updatedAt: new Date()
              })
              .where(and(eq(pantryItems.id, target.id), eq(pantryItems.userId, userId)));

            if (already && twin) {
              await tx.delete(pantryItems).where(and(eq(pantryItems.id, twin.id), eq(pantryItems.userId, userId)));
            }
          } else {
            await tx
              .insert(pantryItems)
              .values({
                grams: amount(entry.grams),
                ingredientId: entry.ingredientId,
                label: entry.label,
                normalisedLabel: entry.normalisedLabel,
                unit: entry.unit,
                userId
              });
          }

          // Read back rather than rebuilt from `standing` and the write, as
          // `KitchenRepository.setStance` does: the list a screen is handed
          // should be the rows, not this function's idea of what they now are.
          const after = await tx.select(COLUMNS).from(pantryItems).where(eq(pantryItems.userId, userId)).orderBy(asc(pantryItems.createdAt));

          return after.map(row => parse(row));
        });

        if (written) {
          return written;
        }
      }

      throw new ConflictError('Another request for this account is still changing the cupboard');
    } catch (error: unknown) {
      // `allow`'s refusal is the controller's answer about the request, not a
      // database failure, so it travels as it is — as `createWithinQuota` lets
      // its own error through. Everything else is wrapped.
      if (error instanceof ConflictError || error instanceof InputParseError) {
        throw error;
      }

      throw wrap(error);
    }
  },

  /**
   * Empties the cupboard.
   *
   * **Idempotent, and that is a decision**: clearing a cupboard that was
   * already empty answers the same as clearing one that was not, because the
   * state the caller asked for is the state they get either way. It is also
   * what the generation calls when it has spent the draft (phase 2), where a
   * refusal on an empty cupboard would be a failure with nothing wrong.
   */
  async clear(userId: string): Promise<void> {
    try {
      await database().delete(pantryItems).where(eq(pantryItems.userId, userId));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Everything this account said it has, in the order it was said.
   *
   * `createdAt` and not the label: the list reads back the way it was typed, so
   * a screen does not reorder itself under somebody's hands.
   *
   * The `userId` in the `WHERE` is the ownership boundary, not a filter — there
   * is no row-level security behind this package, so the clause is what makes
   * one account's cupboard unreachable from another's session.
   */
  async findByUser(userId: string): Promise<readonly PantryItem[]> {
    try {
      const found = await database().select(COLUMNS).from(pantryItems).where(eq(pantryItems.userId, userId)).orderBy(asc(pantryItems.createdAt));

      return found.map(row => parse(row));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Removes one entry by its id, scoped to the session's own account.
   *
   * False for an id that is not this account's **and** for one that does not
   * exist: the controller answers both with the same `NotFoundError`, so an id
   * cannot be used to find out that somebody else's cupboard holds it (`0019`).
   * That is the difference from `KitchenRepository.remove`, where the thing
   * named is a catalogue key every account shares.
   */
  async remove(userId: string, id: string): Promise<boolean> {
    try {
      const removed = await database()
        .delete(pantryItems)
        .where(and(eq(pantryItems.userId, userId), eq(pantryItems.id, id)))
        .returning({ id: pantryItems.id });

      return removed.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

/** Drizzle takes and returns `numeric` as a string, so the conversion happens here and nowhere above. */
function amount(grams: number | null): string | null {
  return grams === null ? null : grams.toFixed(2);
}

function parse(row: Record<string, unknown>): PantryItem {
  return pantryItemSchema.parse(row);
}

/**
 * **The Zod message is deliberately not in it**, which is the one difference
 * from `SafetyRepository`'s otherwise identical `wrap`. A `ZodError` over these
 * rows describes a row holding `label`, and the typed label may not reach an
 * error any more than it may reach a prompt or a log (PRD 022, criterion 7).
 * The table name says enough to find the drift.
 */
function wrap(error: unknown): DatabaseOperationError {
  return new DatabaseOperationError(error instanceof ZodError ? 'Schema mismatch on pantry_items' : undefined);
}
