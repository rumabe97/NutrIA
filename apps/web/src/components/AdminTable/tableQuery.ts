import type { PageQuery } from 'components/PeriodSelector';

/** The part of a Zod object schema these helpers use, so the web needs no Zod of its own. */
interface QuerySchema<T> {
  parse(input: unknown): T;
  readonly shape: Readonly<Record<string, { safeParse(input: unknown): { success: boolean } }>>;
}

/** The first value of a parameter: a repeated one counts once, as the API would refuse it. */
function first(value: PageQuery[string]): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

/**
 * A table's query as the API will accept it, read from the page's address.
 *
 * Each parameter is checked with the API's own schema (`core/entities/AdminQuery`),
 * and one it would refuse is dropped — the table then shows its default for it — so
 * a hand-edited address shows a table rather than a 422 turned into a 404.
 */
export function readTableQuery<T>(schema: QuerySchema<T>, query: PageQuery): T {
  const accepted: Record<string, string> = {};

  for (const [key, field] of Object.entries(schema.shape)) {
    const value = first(query[key]);

    if (value !== undefined && field.safeParse(value).success) {
      accepted[key] = value;
    }
  }

  return schema.parse(accepted);
}

/** A parsed table query as the API's query string: every value that is set, in a stable order. */
export function apiSearch(query: object): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  return search.toString();
}

/**
 * The same page with some parameters changed: a string sets one, `undefined` removes it.
 * Every other parameter is kept as it came, repeated ones included, so a sort or a page
 * never drops the period or a filter.
 */
export function tableHref(pathname: string, query: PageQuery, changes: Readonly<Record<string, string | undefined>>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key in changes || value === undefined) {
      continue;
    }

    for (const one of typeof value === 'string' ? [value] : value) {
      search.append(key, one);
    }
  }

  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) {
      search.set(key, value);
    }
  }

  const text = search.toString();

  return text ? `${pathname}?${text}` : pathname;
}
