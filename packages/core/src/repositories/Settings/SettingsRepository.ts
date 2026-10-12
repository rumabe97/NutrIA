import { and, eq } from 'drizzle-orm';

import { appSettings, tierAllowances } from 'database/schema/platform';
import { database } from 'database';

import { DatabaseOperationError } from 'core/entities/Error';

import type { AllowanceName, Tier } from 'core/domain/Allowance';
import type { RecordAudit } from '#repositories/Audit';

export const SettingsRepository = {
  /**
   * Every switch anybody has ever thrown.
   *
   * All of them in one read rather than one read per flag: the table is a
   * handful of rows and the caller wants the whole set, so a query per key
   * would be a round trip per flag to answer one screen. Absent keys are absent
   * here — what their absence means belongs to `core/domain/Flag`, not to the
   * table.
   */
  async all(): Promise<readonly { readonly enabled: boolean; readonly key: string }[]> {
    try {
      return await database().select({ enabled: appSettings.enabled, key: appSettings.key }).from(appSettings);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every limit anybody has moved from the console, for both tiers (`0097`).
   *
   * All of them in one read, for the same reason the switches are: eight rows at
   * the very most — four limits for each of two tiers — and a caller asking what one tier may spend is about to be
   * asked what the other may too. What an absent row means — and whether a
   * present one may be believed at all — belongs to `resolveAllowances`, never
   * to this table.
   */
  async allowances(): Promise<readonly { readonly name: string; readonly tier: string; readonly value: number }[]> {
    try {
      return await database().select({ name: tierAllowances.key, tier: tierAllowances.tier, value: tierAllowances.value }).from(tierAllowances);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A switch's position, or the default when nobody has touched it.
   *
   * The default is the caller's to state rather than the table's: an absent row
   * means "never decided", and what that should mean is a product question, not
   * a database one.
   */
  async isEnabled(key: string, fallback: boolean): Promise<boolean> {
    try {
      const [row] = await database().select({ enabled: appSettings.enabled }).from(appSettings).where(eq(appSettings.key, key)).limit(1);

      return row?.enabled ?? fallback;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async set(key: string, enabled: boolean, record?: RecordAudit): Promise<void> {
    try {
      await database().transaction(async tx => {
        await tx
          .insert(appSettings)
          .values({ enabled, key })
          .onConflictDoUpdate({ set: { enabled, updatedAt: new Date() }, target: appSettings.key });

        if (record) {
          await record(tx);
        }
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Moves one limit for one tier. The caller has already checked it against the
   * registry's bounds.
   *
   * **A limit put back to what the code ships has its row deleted**, rather
   * than stored as a number that happens to match. Stored, it would stop being
   * the shipped number the day a release changes that number: a tier pinned to
   * twenty swaps because somebody once pressed "back to what it ships" would
   * stay on twenty while every new account got twenty-four, silently and for
   * ever. Deleting means the sentence "a limit nobody has moved is whatever the
   * code ships" stays true in both directions.
   */
  async setAllowance(tier: Tier, key: AllowanceName, value: number, shipped: number, record?: RecordAudit): Promise<void> {
    try {
      await database().transaction(async tx => {
        if (value === shipped) {
          await tx.delete(tierAllowances).where(and(eq(tierAllowances.tier, tier), eq(tierAllowances.key, key)));
        } else {
          await tx
            .insert(tierAllowances)
            .values({ key, tier, value })
            .onConflictDoUpdate({ set: { updatedAt: new Date(), value }, target: [tierAllowances.tier, tierAllowances.key] });
        }

        if (record) {
          await record(tx);
        }
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
