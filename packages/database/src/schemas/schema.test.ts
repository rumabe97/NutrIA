import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

import * as schema from './index';

import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Structural guarantees the application code silently depends on.
 *
 * These exist because a mismatch here does not fail a type-check or a unit test —
 * it fails at runtime against real Postgres, as an opaque 500. The profile upsert
 * shipped that way: `ON CONFLICT (user_id)` needs a UNIQUE constraint, `userOwned`
 * emitted a plain index, and nothing noticed until someone completed the first
 * onboarding step.
 */

/** One row per user. Every one of these is written with an upsert on `user_id`. */
const SINGLETON_TABLES = ['profiles', 'user_preferences', 'onboarding_state', 'target_overrides', 'health_data_consents', 'professionals'];

/**
 * The barrel exports tables, enums and column helpers together. A type predicate
 * cannot narrow that union to `PgTable` (each table has its own literal name type),
 * so the check is a runtime one and the cast is explicit.
 */
function isTable(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Symbol.for('drizzle:Name') in value;
}

const tables = Object.values(schema).filter(isTable) as unknown as PgTable[];

/**
 * `getTableConfig` reports the TypeScript key (`userId`); the snake_case mapping to
 * `user_id` happens in the client at query time. Accept either so the assertion
 * describes the column rather than the naming convention.
 */
function isUserId(name: string): boolean {
  return name === 'userId' || name === 'user_id';
}

function config(name: string) {
  const table = tables.find(candidate => getTableConfig(candidate).name === name);

  if (!table) {
    throw new Error(`No table named "${name}" in the schema barrel`);
  }

  return getTableConfig(table);
}

describe('user-scoped tables', () => {
  it('finds every table through the barrel', () => {
    expect(tables.length).toBeGreaterThan(30);
  });

  it.each(SINGLETON_TABLES)('%s has a UNIQUE constraint on user_id, which ON CONFLICT requires', name => {
    const unique = config(name).uniqueConstraints.some(constraint => constraint.columns.some(column => isUserId(column.name)));

    expect(unique).toBe(true);
  });

  it('gives every table with a user_id an index or unique constraint on it', () => {
    // Ownership is a WHERE clause on every user-scoped read; unindexed it is a
    // sequential scan on the busiest query in the product.
    const missing = tables
      .map(table => getTableConfig(table))
      .filter(table => table.columns.some(column => isUserId(column.name)))
      .filter(
        table =>
          !table.indexes.some(index => index.config.columns.some(column => 'name' in column && isUserId(String(column.name)))) &&
          !table.uniqueConstraints.some(constraint => constraint.columns.some(column => isUserId(column.name)))
      )
      .map(table => table.name);

    expect(missing).toEqual([]);
  });

  it('cascades every user_id foreign key on delete, so account deletion really deletes', () => {
    const notCascading = tables
      .map(table => getTableConfig(table))
      .flatMap(table =>
        table.foreignKeys
          .filter(key => key.reference().columns.some(column => isUserId(column.name)))
          .filter(key => key.onDelete !== 'cascade')
          .map(() => table.name)
      );

    expect(notCascading).toEqual([]);
  });
});

describe('the link between a professional and a client (0059)', () => {
  it.each(['care_links', 'care_invitations'])('%s goes with either account it names', name => {
    // No `user_id` column here, so the check above does not see these: a link
    // names two accounts, and deleting either must take it (PRD 004, criterion 14).
    const keys = config(name).foreignKeys.map(key => ({ onDelete: key.onDelete, table: getTableConfig(key.reference().foreignTable).name }));

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every(key => key.table === 'user' && key.onDelete === 'cascade')).toBe(true);
  });

  it('allows one open link per client, and only one', () => {
    const index = config('care_links').indexes.find(candidate => candidate.config.name === 'care_links_one_open_per_client');

    expect(index?.config.unique).toBe(true);
    expect(index?.config.where).toBeDefined();
  });

  it('stores a token only as its hash, unique', () => {
    const table = config('care_invitations');

    expect(table.columns.map(column => column.name)).not.toContain('token');
    expect(
      table.uniqueConstraints.some(constraint => constraint.columns.some(column => column.name === 'token_hash' || column.name === 'tokenHash'))
    ).toBe(true);
  });

  it('keeps an invitation only while it is live: no answered or set-aside rows, one per professional and address', () => {
    const table = config('care_invitations');
    const names = table.columns.map(column => column.name);
    const onePerAddress = table.indexes.find(candidate => candidate.config.name === 'care_invitations_one_per_address');

    // Answering or replacing an invitation deletes it, so there is no state to record (PRD 004, criterion 14).
    expect(names.some(name => /used|revoked/i.test(name))).toBe(false);
    expect(onePerAddress?.config.unique).toBe(true);
    expect(onePerAddress?.config.where).toBeUndefined();
    expect(onePerAddress?.config.columns.map(column => (column as { name: string }).name)).toEqual(['professionalId', 'email']);
  });
});
