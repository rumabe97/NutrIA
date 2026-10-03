import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

import { timestamps } from './_columns';

export const userRole = pgEnum('user_role', ['user', 'admin']);

/**
 * What an account is allowed to spend (`0042`).
 *
 * Two values and no dates: while the owner grants this by hand there is nothing
 * to expire. If billing ever writes it, it will bring a subscription table with
 * its own periods, and this column will say what that table decided rather than
 * trying to hold the decision itself.
 */
export const userTier = pgEnum('user_tier', ['free', 'premium']);

/**
 * Better Auth owns the four tables below and maps onto them **by name** through
 * its Drizzle adapter — column names here are its contract, not our choice.
 * `role` is the one column we add; it is the only thing `AdminGuard` trusts.
 *
 * Ids are `text` because that is Better Auth's default id type. App tables use
 * `uuid` ids and reference this one through a `text` `userId`.
 */
export const user = pgTable('user', {
  id: text().primaryKey(),
  /**
   * When the owner opened this account (`0017`, `0030`) — null while it waits.
   *
   * Separate from `emailVerified` because they answer different questions and
   * only one of them is the door. A verification link proves the address is
   * real, which is the person's own business; this is the owner's decision, and
   * conflating them meant a confirmation mail would have handed out the key.
   */
  activatedAt: timestamp({ withTimezone: true }),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  name: text().notNull(),
  /**
   * When a sign-in found this account's password in the breach corpus (PLAN 011
   * phase 2) — null while it is not known to be. Set at most once, cleared by a
   * change or a reset. A timestamp and nothing else: never the password, its
   * hash or its prefix. While it is set, every route but `/users/me` and
   * `/auth/*` answers 409 `PASSWORD_CHANGE_REQUIRED`.
   */
  passwordCompromisedAt: timestamp({ withTimezone: true }),
  role: userRole().notNull().default('user'),
  /**
   * When the server recorded that this account was created under `termsVersion`
   * of `/condiciones` (`0071`, phase 7) — null before recording existed.
   * Written only by `databaseHooks.user.create.before`; `input: false`.
   */
  termsAcceptedAt: timestamp({ withTimezone: true }),
  /** The `TERMS_VERSION` in force at sign-up; null means the account predates the record, never "unknown version". */
  termsVersion: text(),
  tier: userTier().notNull().default('free'),
  /**
   * The second factor is on (PLAN 011 phase 3): Better Auth's two-factor
   * plugin sets it on the first correct code after `/two-factor/enable`, and
   * clears it on `/two-factor/disable`. A sign-in with a password then answers
   * a challenge instead of a session. Never written by a client (`input: false`).
   */
  twoFactorEnabled: boolean().notNull().default(false),
  ...timestamps
});

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    token: text().notNull().unique(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  table => [index('session_user_id_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    accessToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    accountId: text().notNull(),
    idToken: text(),
    password: text(),
    providerId: text().notNull(),
    refreshToken: text(),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  table => [index('account_user_id_idx').on(table.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    ...timestamps
  },
  table => [index('verification_identifier_idx').on(table.identifier)]
);

/**
 * The authenticator-app secret and the backup codes of an account with a
 * second factor (PLAN 011 phase 3) — Better Auth's two-factor plugin owns the
 * table and its columns, like the four above. Both secrets are stored
 * encrypted with `BETTER_AUTH_SECRET`; neither is ever returned by a route but
 * `/two-factor/enable` and `/two-factor/generate-backup-codes`, once, to their
 * owner.
 *
 * One row per account, and the UNIQUE says so: the plugin looks a row up by
 * `userId` and finds one. `verified` is false between `/enable` and the first
 * correct code; the two counters are the plugin's lockout after repeated wrong
 * codes.
 */
export const twoFactor = pgTable(
  'two_factor',
  {
    id: text().primaryKey(),
    backupCodes: text().notNull(),
    failedVerificationCount: integer().notNull().default(0),
    /**
     * The newest 30-second TOTP step a code from this account was accepted for
     * (PLAN 011 phase 4) — null until the first. Ours, not the plugin's: a
     * `hooks.before` on `/two-factor/verify-totp` claims a step only if it is
     * greater, so one code is never accepted twice, nor an older one after it.
     */
    lastTotpStep: bigint({ mode: 'number' }),
    lockedUntil: timestamp({ withTimezone: true }),
    secret: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: boolean().notNull().default(true)
  },
  table => [unique('two_factor_user_id_unique').on(table.userId)]
);

/**
 * An account's passkeys (PLAN 011 phase 5) — Better Auth's passkey plugin owns
 * the table and its columns, like the ones above. A row is the public half of
 * a key that lives on the person's device: nothing here signs anybody in by
 * itself. Bound to the web origin's host (`rpID`); a new domain voids them all
 * (`0074`).
 *
 * `credential_id` is UNIQUE where the plugin only indexes it: a sign-in looks
 * the key up by that id alone, before it knows the account, and with
 * attestation `none` the id is whatever the registering client sent — one
 * account must not be able to register another's id and so stand in the way
 * of, or in front of, its sign-in. A second account offering an id already
 * registered fails on this constraint inside the plugin's insert, which
 * Better Auth answers with a 500: nothing is stored and nothing is said about
 * whose the id is, so the 500 is acceptable.
 */
export const passkey = pgTable(
  'passkey',
  {
    id: text().primaryKey(),
    aaguid: text(),
    backedUp: boolean().notNull(),
    /** WebAuthn's signature counter, an unsigned 32-bit number — past `integer`'s range. Synced passkeys keep it at 0. */
    counter: bigint({ mode: 'number' }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow(),
    credentialID: text().notNull(),
    deviceType: text().notNull(),
    /** What the person called it; the plugin leaves it null when they gave none. */
    name: text(),
    publicKey: text().notNull(),
    /** Comma-separated, as the plugin writes it (`usb,nfc,internal,hybrid`). */
    transports: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  table => [unique('passkey_credential_id_unique').on(table.credentialID), index('passkey_user_id_idx').on(table.userId)]
);

/**
 * Better Auth's rate-limit counters, in the database rather than in a process.
 *
 * The one place a per-instance count is actually dangerous: this is what stands
 * between someone and an unlimited number of password guesses, and a serverless
 * host runs as many instances as it likes (`0007`, amended). Its columns are
 * Better Auth's contract, like the four tables above.
 *
 * Rows are transient. Better Auth deletes expired ones as it goes, so this table
 * holds roughly one row per active key and not a history.
 */
export const rateLimit = pgTable('rate_limit', {
  id: text().primaryKey(),
  count: integer().notNull().default(0),
  key: text().notNull().unique(),
  /** Epoch milliseconds, as Better Auth writes it. */
  lastRequest: bigint({ mode: 'number' }).notNull()
});
