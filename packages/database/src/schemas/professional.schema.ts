import { boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';

import { user } from './auth.schema';
import { userOwnedSingleton } from './_utils';

/**
 * An account the owner has made a professional (`0059`), one row per account.
 *
 * The row *is* the grant: an account is a professional while it has one and
 * stops being one when it is deleted. Only the owner's act on `/admin` writes
 * it — no sign-up field, request body or client state can — and `user.role` is
 * untouched, so the owner may be both an admin and a professional and the
 * admin guard keeps meaning one thing.
 *
 * `grantedBy` is `set null` on delete: the grant outlives the granting account,
 * because it is the professional's, not the owner's. `practiceOpen` and
 * `includedClients` are what a practice subscription writes (`0061`); until
 * billing exists they hold their defaults, which grant nothing.
 */
export const professionals = userOwnedSingleton('professionals', {
  /**
   * When the professional accepted their agreement (`docs/legal/textos/01`), and
   * which version: both null until they do, so a grant starts unaccepted. A
   * version that is not `PROFESSIONAL_AGREEMENT_VERSION` asks again.
   */
  agreementAcceptedAt: timestamp({ withTimezone: true }),
  agreementVersion: text(),
  /** Required, never a declaration: the owner types it from the register. */
  collegiateNumber: text().notNull(),
  grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  grantedBy: text().references(() => user.id, { onDelete: 'set null' }),
  /** How many active clients the practice plan includes. Zero until a price says otherwise. */
  includedClients: integer().notNull().default(0),
  /** Whether the practice is paid for. False until a price says otherwise. */
  practiceOpen: boolean().notNull().default(false)
});
