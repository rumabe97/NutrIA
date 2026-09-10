import { asc, eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { healthConditions, healthDataConsents, medications, supplements } from 'database/schema/profile';

import { DatabaseOperationError } from 'core/entities/Error';
import { healthConditionSchema, medicationSchema, supplementSchema } from 'core/entities/Health';
import type { HealthCondition, Medication, SetHealthData, Supplement } from 'core/entities/Health';

export type StoredHealthData = {
  readonly conditions: readonly HealthCondition[];
  /** Null when the user has never consented, or consented to an older notice. */
  readonly consentVersion: string | null;
  readonly medications: readonly Medication[];
  readonly supplements: readonly Supplement[];
};

export const HealthRepository = {
  /**
   * Removes every trace of the health section, consent included.
   *
   * Withdrawing consent deletes the data in the same transaction that deletes
   * the record of having agreed. Keeping either without the other is the state
   * nobody can explain afterwards: data held without consent, or a consent for
   * data that is gone.
   */
  async deleteAll(userId: string): Promise<void> {
    try {
      await database().transaction(async tx => {
        await tx.delete(healthConditions).where(eq(healthConditions.userId, userId));
        await tx.delete(medications).where(eq(medications.userId, userId));
        await tx.delete(supplements).where(eq(supplements.userId, userId));
        await tx.delete(healthDataConsents).where(eq(healthDataConsents.userId, userId));
      });
    } catch (error: unknown) {
      throw wrap(error, 'health_conditions');
    }
  },

  async findAll(userId: string): Promise<StoredHealthData> {
    try {
      const db = database();
      const [conditionRows, medicationRows, supplementRows, consentRows] = await Promise.all([
        db
          .select({ id: healthConditions.id, conditionKey: healthConditions.conditionKey, label: healthConditions.label })
          .from(healthConditions)
          .where(eq(healthConditions.userId, userId))
          .orderBy(asc(healthConditions.label)),
        db
          .select({ id: medications.id, name: medications.name })
          .from(medications)
          .where(eq(medications.userId, userId))
          .orderBy(asc(medications.name)),
        db
          .select({
            id: supplements.id,
            name: supplements.name,
            proteinGPerServing: supplements.proteinGPerServing,
            servingsPerDay: supplements.servingsPerDay
          })
          .from(supplements)
          .where(eq(supplements.userId, userId))
          .orderBy(asc(supplements.name)),
        db.select({ version: healthDataConsents.version }).from(healthDataConsents).where(eq(healthDataConsents.userId, userId)).limit(1)
      ]);

      return {
        conditions: conditionRows.map(row => healthConditionSchema.parse(row)),
        consentVersion: consentRows[0]?.version ?? null,
        medications: medicationRows.map(row => medicationSchema.parse(row)),
        supplements: supplementRows.map(row =>
          supplementSchema.parse({ ...row, proteinGPerServing: row.proteinGPerServing === null ? null : Number(row.proteinGPerServing) })
        )
      };
    } catch (error: unknown) {
      throw wrap(error, 'health data');
    }
  },

  /**
   * Replace-all, in one transaction, consent included.
   *
   * Transactional for the reason `SafetyRepository.replaceAll` is: the
   * intermediate state is a user with no recorded conditions, and nothing may
   * observe it. Consent is written in the same transaction because holding the
   * data and holding the agreement to hold it are one act.
   */
  async replaceAll(userId: string, input: SetHealthData): Promise<void> {
    try {
      await database().transaction(async tx => {
        await tx.delete(healthConditions).where(eq(healthConditions.userId, userId));
        await tx.delete(medications).where(eq(medications.userId, userId));
        await tx.delete(supplements).where(eq(supplements.userId, userId));

        if (input.conditions.length > 0) {
          await tx.insert(healthConditions).values(input.conditions.map(c => ({ conditionKey: c.conditionKey ?? null, label: c.label, userId })));
        }

        if (input.medications.length > 0) {
          await tx.insert(medications).values(input.medications.map(m => ({ name: m.name, userId })));
        }

        if (input.supplements.length > 0) {
          await tx
            .insert(supplements)
            .values(
              input.supplements.map(s => ({
                name: s.name,
                proteinGPerServing: s.proteinGPerServing === null || s.proteinGPerServing === undefined ? null : String(s.proteinGPerServing),
                servingsPerDay: s.servingsPerDay,
                userId
              }))
            );
        }

        const consent = { grantedAt: new Date(), version: input.consentVersion };

        await tx
          .insert(healthDataConsents)
          .values({ ...consent, userId })
          .onConflictDoUpdate({ set: consent, target: healthDataConsents.userId });
      });
    } catch (error: unknown) {
      throw wrap(error, 'health data');
    }
  }
};

function wrap(error: unknown, table: string): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on ${table}: ${error.message}`);
  }

  return new DatabaseOperationError();
}
