import { eq } from 'drizzle-orm';

import { appSettings } from 'database/schema/platform';
import { database } from 'database';

import { DatabaseOperationError } from 'core/entities/Error';

export const SettingsRepository = {
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
