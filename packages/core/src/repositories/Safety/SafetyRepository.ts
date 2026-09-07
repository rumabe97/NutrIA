import { aliasedTable, and, asc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { allergens, allergies, customAllergens, intolerances } from 'database/schema/safety';
import { ingredientNames, ingredients } from 'database/schema/food';

import { DatabaseOperationError } from 'core/entities/Error';
import { allergenSchema, allergySchema, customAllergenSchema, intoleranceSchema } from 'core/entities/Safety';
import type { Allergen, Allergy, CustomAllergen, Intolerance, SetAllergies } from 'core/entities/Safety';
import { FALLBACK_LOCALE } from '#repositories/Recipe';
import type { MatchableIngredient, ResolvedCustomAllergen } from 'core/domain/Safety';

export const SafetyRepository = {
  async findAllergies(userId: string): Promise<readonly Allergy[]> {
    try {
      const rows = await database()
        .select({
          id: allergies.id,
          allergenId: allergies.allergenId,
          allergenKey: allergens.key,
          allergenLabel: allergens.labelEs,
          crossContaminationSensitive: allergies.crossContaminationSensitive,
          notes: allergies.notes,
          severity: allergies.severity
        })
        .from(allergies)
        .innerJoin(allergens, eq(allergens.id, allergies.allergenId))
        .where(eq(allergies.userId, userId));

      return rows.map(row => allergySchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error, 'allergies');
    }
  },

  /**
   * Free-text allergies with the catalogue row each one resolved to, if any.
   *
   * Left join, not inner: an entry that matched nothing is exactly the case this
   * table exists to record, and an inner join would hide precisely the rows we
   * must be honest about.
   */
  async findCustomAllergens(userId: string, locale: string = FALLBACK_LOCALE): Promise<readonly CustomAllergen[]> {
    try {
      const requested = aliasedTable(ingredientNames, 'requested_name');
      const fallback = aliasedTable(ingredientNames, 'fallback_name');

      const rows = await database()
        .select({
          id: customAllergens.id,
          fallbackName: fallback.name,
          ingredientId: customAllergens.ingredientId,
          label: customAllergens.label,
          requestedName: requested.name
        })
        .from(customAllergens)
        .leftJoin(requested, and(eq(requested.ingredientId, customAllergens.ingredientId), eq(requested.locale, locale)))
        .leftJoin(fallback, and(eq(fallback.ingredientId, customAllergens.ingredientId), eq(fallback.locale, FALLBACK_LOCALE)))
        .where(eq(customAllergens.userId, userId))
        .orderBy(asc(customAllergens.label));

      return rows.map(row =>
        customAllergenSchema.parse({
          id: row.id,
          ingredientId: row.ingredientId,
          // Null stays null: no ingredient means no name, and the absence is the
          // whole signal — it is what makes the entry best-effort.
          ingredientName: row.ingredientId === null ? null : (row.requestedName ?? row.fallbackName),
          label: row.label
        })
      );
    } catch (error: unknown) {
      throw wrap(error, 'custom_allergens');
    }
  },

  async findIntolerances(userId: string): Promise<readonly Intolerance[]> {
    try {
      const rows = await database()
        .select({
          id: intolerances.id,
          allergenId: intolerances.allergenId,
          allergenKey: allergens.key,
          allergenLabel: allergens.labelEs,
          notes: intolerances.notes
        })
        .from(intolerances)
        .innerJoin(allergens, eq(allergens.id, intolerances.allergenId))
        .where(eq(intolerances.userId, userId));

      return rows.map(row => intoleranceSchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error, 'intolerances');
    }
  },

  /** The shared catalogue. Not user-scoped — it is reference data. */
  async listAllergens(): Promise<readonly Allergen[]> {
    try {
      const rows = await database().select().from(allergens).orderBy(asc(allergens.labelEs));

      return rows.map(row => allergenSchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error, 'allergens');
    }
  },

  /**
   * The minimal projection the free-text matcher needs: id, name and slug.
   *
   * **One row per name, across every locale**, so a user typing "broccoli" and
   * one typing "brócoli" both resolve to the same ingredient. The matcher
   * de-duplicates by id, so the repetition costs nothing and the alternative —
   * matching only the user's own language — would mean an English speaker's
   * allergy going unenforced for want of a translation nobody thought about.
   *
   * Deliberately not `loadCatalogue()`: that carries macros and allergen links
   * for every ingredient, and matching a word against a name has no business
   * loading either.
   */
  async listMatchableIngredients(): Promise<readonly MatchableIngredient[]> {
    try {
      return await database()
        .select({ id: ingredients.id, name: ingredientNames.name, slug: ingredients.slug })
        .from(ingredientNames)
        .innerJoin(ingredients, eq(ingredients.id, ingredientNames.ingredientId));
    } catch (error: unknown) {
      throw wrap(error, 'ingredients');
    }
  },

  /**
   * Replace-all inside one transaction.
   *
   * Transactional because the intermediate state — allergies deleted, not yet
   * re-inserted — is a profile with *no* allergies. If anything read it there,
   * or the process died there, the user would silently become someone with no
   * restrictions. Delete-then-insert is only safe if nothing can observe the gap.
   */
  async replaceAll(userId: string, input: SetAllergies, resolvedCustomAllergens: readonly ResolvedCustomAllergen[] = []): Promise<void> {
    try {
      await database().transaction(async tx => {
        await tx.delete(allergies).where(eq(allergies.userId, userId));
        await tx.delete(customAllergens).where(eq(customAllergens.userId, userId));
        await tx.delete(intolerances).where(eq(intolerances.userId, userId));

        if (input.allergies.length > 0) {
          await tx.insert(allergies).values(
            input.allergies.map(a => ({
              allergenId: a.allergenId,
              crossContaminationSensitive: a.crossContaminationSensitive,
              notes: a.notes ?? null,
              severity: a.severity,
              userId
            }))
          );
        }

        if (input.intolerances.length > 0) {
          await tx.insert(intolerances).values(input.intolerances.map(i => ({ allergenId: i.allergenId, notes: i.notes ?? null, userId })));
        }

        // Resolution happens above this layer, against the domain matcher. The
        // repository stores what it is given and never decides what a word means.
        if (resolvedCustomAllergens.length > 0) {
          await tx.insert(customAllergens).values(resolvedCustomAllergens.map(entry => ({ ingredientId: entry.ingredientId, label: entry.label, userId })));
        }
      });
    } catch (error: unknown) {
      throw wrap(error, 'allergies');
    }
  }
};

function wrap(error: unknown, table: string): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on ${table}: ${error.message}`);}

  return new DatabaseOperationError();
}
