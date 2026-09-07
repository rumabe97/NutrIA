import { boolean, index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { timestamps } from './_columns';

export const userRole = pgEnum('user_role', ['user', 'admin']);

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
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  name: text().notNull(),
  role: userRole().notNull().default('user'),
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
