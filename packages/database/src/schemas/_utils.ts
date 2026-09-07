import { index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './_columns';
import { user } from './auth.schema';

import type { PgColumnBuilderBase } from 'drizzle-orm/pg-core';

export type Column = { [K in string]: PgColumnBuilderBase };

/**
 * A table owned by exactly one user.
 *
 * Gives every row an `id`, a cascading `userId` FK, timestamps, and — the part
 * that is easy to forget — an index on `userId`, because every ownership-scoped
 * query filters on it.
 *
 * The cascade is what makes account deletion actually delete the account's data
 * (see `docs/ARCHITECTURE.md` § Privacy). It is not a convenience.
 *
 * Ownership is enforced in application code, not by database policies: the API
 * owns the only connection, so a WHERE clause on `userId` is the boundary.
 */
export function userOwned<T extends Column>(tableName: string, columns: T) {
  return pgTable(
    tableName,
    {
      id: uuid().primaryKey().defaultRandom(),
      userId: text()
        .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
        .notNull(),
      ...columns,
      ...timestamps
    },
    table => [index(`${tableName}_user_id_idx`).on(table.userId)]
  );
}

/**
 * A table holding **exactly one row per user** — a profile, a set of preferences,
 * an onboarding state.
 *
 * The difference from `userOwned` is a UNIQUE constraint rather than a plain index
 * on `userId`, and it is not cosmetic: `ON CONFLICT (user_id)` requires a unique
 * constraint to match against. Without one, every `onConflictDoUpdate` upsert fails
 * at runtime with Postgres 42P10 — which surfaces as an opaque 500, because a
 * repository must not leak driver messages.
 *
 * It also states the cardinality the code already assumes. A second profile row for
 * one user would make `findByUserId` return an arbitrary one of them.
 */
export function userOwnedSingleton<T extends Column>(tableName: string, columns: T) {
  return pgTable(
    tableName,
    {
      id: uuid().primaryKey().defaultRandom(),
      userId: text()
        .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
        .notNull(),
      ...columns,
      ...timestamps
    },
    table => [unique(`${tableName}_user_id_key`).on(table.userId)]
  );
}
