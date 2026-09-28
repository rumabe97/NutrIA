import { and, getTableName, gte, lt, sql } from 'drizzle-orm';

import { CONSOLE_TIME_ZONE } from 'core/entities/Period';

import type { SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/**
 * The Madrid calendar day of a timestamp, as `YYYY-MM-DD` (`0068`).
 *
 * The zone is written into the SQL rather than bound as a parameter: the same
 * fragment is both selected and grouped by, and two bound copies would be two
 * different placeholders Postgres cannot tell are one expression. It is a
 * constant, never input.
 */
export function madridDay(column: PgColumn): SQL<string> {
  return sql<string>`to_char(date_trunc('day', ${column} at time zone ${sql.raw(`'${CONSOLE_TIME_ZONE}'`)}), 'YYYY-MM-DD')`;
}

/** `[from, to)` on a timestamp column. The column encodes the values, so a `Date` is safe here. */
export function within(column: PgColumn, from: Date, to: Date): SQL | undefined {
  return and(gte(column, from), lt(column, to));
}

/**
 * A column always written `"table"."column"`.
 *
 * Drizzle drops the table from a column in a query over one table, and inside
 * a sub-select a bare `"id"` binds to the *inner* table, which silently
 * correlates nothing (project 007, phase 5). Written out, it can only mean the
 * outer row.
 */
export function qualified(table: PgTable, column: string): SQL {
  return sql`${sql.identifier(getTableName(table))}.${sql.identifier(column)}`;
}
