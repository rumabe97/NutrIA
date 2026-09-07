import { asc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { allergens, allergies, intolerances } from 'database/schema/safety';

import { DatabaseOperationError } from 'core/entities/Error';
import { allergenSchema, allergySchema, intoleranceSchema } from 'core/entities/Safety';
import type { Allergen, Allergy, Intolerance, SetAllergies } from 'core/entities/Safety';

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
   * Replace-all inside one transaction.
   *
   * Transactional because the intermediate state — allergies deleted, not yet
   * re-inserted — is a profile with *no* allergies. If anything read it there,
   * or the process died there, the user would silently become someone with no
   * restrictions. Delete-then-insert is only safe if nothing can observe the gap.
   */
  async replaceAll(userId: string, input: SetAllergies): Promise<void> {
    try {
      await database().transaction(async tx => {
        await tx.delete(allergies).where(eq(allergies.userId, userId));
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
