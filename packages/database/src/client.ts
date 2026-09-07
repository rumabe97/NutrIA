import postgres from 'postgres';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';

import { required } from './env';

import * as schema from './schemas';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | undefined;
let pool: postgres.Sql | undefined;

/**
 * The single Drizzle instance for the whole process.
 *
 * Only `apps/api` reaches this — the browser never holds a database connection
 * (see `docs/ARCHITECTURE.md` § Data access). Authorisation is NOT delegated to
 * the database: every user-scoped read and write filters on `userId` in
 * `packages/core/repositories`, and the API layer verifies session ownership
 * before it gets here.
 *
 * Lazily constructed so importing this module never requires env — tests that
 * only touch entities or pure logic stay connection-free.
 *
 * `prepare: false` is required: Neon's pooled endpoint is PgBouncer in
 * transaction mode, which cannot carry named prepared statements across
 * checkouts. Point `DATABASE_URL` at the pooled host; `DIRECT_DATABASE_URL`
 * (session mode) is for migrations only and is read by `drizzle.config.ts`.
 */
export function database(): Database {
  if (!instance) {
    pool = postgres(required('DATABASE_URL'), { prepare: false });
    instance = drizzle({ casing: 'snake_case', client: pool, schema });
  }

  return instance;
}

/** Closes the pool. Call from the API's shutdown hook and at the end of scripts. */
export async function closeDatabase(): Promise<void> {
  await pool?.end();
  instance = undefined;
  pool = undefined;
}

/**
 * Cheapest statement that proves a connection can be checked out of the pool.
 *
 * Lives here rather than in the API's health indicator so that no app has to
 * import `drizzle-orm` to build SQL — and so the API's ESM type resolution of
 * drizzle never has to line up with this package's CommonJS one.
 */
export async function ping(): Promise<void> {
  await database().execute(sql`select 1`);
}
