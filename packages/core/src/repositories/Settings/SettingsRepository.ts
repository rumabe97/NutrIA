import { eq } from 'drizzle-orm';

import { appSettings } from 'database/schema/platform';
import { database } from 'database';

import { DatabaseOperationError } from 'core/entities/Error';

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

  async set(key: string, enabled: boolean): Promise<void> {
    try {
      await database()
        .insert(appSettings)
        .values({ enabled, key })
        .onConflictDoUpdate({ set: { enabled, updatedAt: new Date() }, target: appSettings.key });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
