import { ilike, sql } from 'drizzle-orm';

import type { Column, SQL, SQLWrapper } from 'drizzle-orm';
import type { SortDirection } from 'core/entities/AdminQuery';

/**
 * Text typed into a search box as a `LIKE` pattern that matches it literally:
 * `%`, `_` and the escape character itself are escaped, so "50%" finds "50%"
 * and not every address with "50" in it. Postgres's default `LIKE` escape is
 * the backslash, and with `standard_conforming_strings` (the default) a bound
 * parameter's backslash reaches `LIKE` as one.
 */
export function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, match => `\\${match}`);
}

/**
 * `column ILIKE '%text%'`, case-insensitive, with the text escaped and bound as
 * a parameter — never written into the SQL.
 */
export function contains(column: Column, text: string): SQL {
  return ilike(column, `%${likeLiteral(text)}%`);
}

/**
 * A direction from the allow-list as an `ORDER BY` term, an empty value last
 * either way: an account nobody has seen yet belongs at the end of "latest
 * activity", not at its head. Two literal fragments, so no direction is ever
 * written into the SQL from a value.
 */
export function ordered(column: SQLWrapper, direction: SortDirection): SQL {
  return direction === 'asc' ? sql`${column} asc nulls last` : sql`${column} desc nulls last`;
}
