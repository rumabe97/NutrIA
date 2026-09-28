import type { Period } from 'core/entities/Period';

/** A page's query as Next hands it to a Server Component. */
export type PageQuery = Readonly<Record<string, readonly string[] | string | undefined>>;

/**
 * The same page with another period, and every other parameter kept as it came —
 * repeated ones included, in their order — so choosing a period never drops a
 * filter or the `?abierta=` of a mailed link.
 */
export function periodHref(pathname: string, query: PageQuery, period: Period): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === 'period' || value === undefined) {
      continue;
    }

    for (const one of typeof value === 'string' ? [value] : value) {
      search.append(key, one);
    }
  }

  search.set('period', String(period));

  return `${pathname}?${search.toString()}`;
}
