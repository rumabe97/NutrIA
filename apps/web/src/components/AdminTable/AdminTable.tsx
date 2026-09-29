import { Fragment } from 'react';

import Link from 'next/link';

import styles from './AdminTable.module.css';

import { Button } from 'ui/components/Button';
import { DataTable } from 'ui/components/DataTable';
import { Input } from 'ui/components/Input';

import { AdminFilter } from './components/AdminFilter';
import { AdminFilters } from './components/AdminFilters';
import { AdminPager } from './components/AdminPager';
import { AdminTableForm } from './components/AdminTableForm';
import { AdminTableStatus } from './components/AdminTableStatus';
import { Card } from 'components/Card';

import { PAGE_SIZES } from 'core/entities/AdminQuery';

import { formatNumber, interpolate } from 'lib/format';

import { tableHref } from './tableQuery';

import type { AdminFilterOption } from './components/AdminFilter';
import type { DataTableColumn, DataTableRow } from 'ui/components/DataTable';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';
import type { PageQuery } from 'components/PeriodSelector';
import type { SortDirection } from 'core/entities/AdminQuery';

export interface AdminTableColumn extends Pick<DataTableColumn, 'align' | 'header' | 'key'> {
  /**
   * The API's name for this column's order, which way the first click sorts, and how the
   * status line names the order ("por fecha de alta") — a phrase, not the header, which is
   * a label ("Desde") that reads wrong after "por". Omit for a column that does not sort.
   */
  readonly sort?: { readonly first: SortDirection; readonly phrase: string; readonly value: string };
}

/** A filter that picks one of a list: a native `<select>`. */
interface AdminSelectFilter {
  /** The option that sends nothing ("Cualquiera"). */
  readonly anyLabel: string;
  readonly kind?: 'select';
  readonly label: string;
  /** The query parameter. */
  readonly name: string;
  readonly options: readonly AdminFilterOption[];
  /** What the address says now, or undefined for "any". */
  readonly value: string | undefined;
}

/** A filter that takes a calendar day (`YYYY-MM-DD`): a native date field. Empty is "any". */
interface AdminDateFilter {
  readonly kind: 'date';
  readonly label: string;
  /** The query parameter. */
  readonly name: string;
  /** What the address says now, or undefined for "any". */
  readonly value: string | undefined;
}

export type AdminTableFilter = AdminDateFilter | AdminSelectFilter;

interface AdminTableProps {
  /** Names the table and its scroll region. Hidden: the section's heading is on screen. */
  caption: string;
  columns: readonly AdminTableColumn[];
  /** What the table says when there is nothing at all. */
  empty: string;
  filters?: readonly AdminTableFilter[];
  locale: Locale;
  /** What the table says when a search or a filter leaves nothing. */
  noMatch: string;
  /** Where the rows start and how many a page holds. Omit for a table the API does not page. */
  paging?: { readonly offset: number; readonly size: number };
  /** The page's own address and query: every link and the form keep what they do not change. */
  pathname: string;
  query: PageQuery;
  rows: readonly DataTableRow[];
  /**
   * The search field (always the parameter `q`: the API's log redacts only that one).
   * Omit for a table the API takes no free text for — the toolbar then holds only its
   * filters.
   */
  search?: { readonly label: string; readonly value: string | undefined };
  /** The order the rows came in. Omit for a table in one fixed order, which its section says. */
  sort?: { readonly dir: SortDirection; readonly value: string };
  /** Every row the search and filters match, not only this page. */
  total: number;
  words: Dictionary['adminConsole']['table'];
}

/** Parameters a new search, filter or order leaves behind: the page, and the banner of a mailed link. */
const TRANSIENT = ['abierta', 'offset'];

/**
 * The table's anchor. Every link it draws and the form without JavaScript land on it, so
 * a sort, a page or a search keeps the table in view instead of starting at the top of
 * the page — on a reload the browser scrolls to it, through the router Next does.
 */
const ANCHOR = 'tabla';

/**
 * A console table (`0068`): a toolbar, a line that says what is shown, the table, and
 * a pager. Everything it shows is in the address.
 *
 * - The toolbar is a GET form — search (`q`), filters, page size — that works without
 *   JavaScript; `AdminTableForm` applies it as it changes when JavaScript is there. It
 *   carries every other parameter (the period, the order) as hidden fields, and never
 *   the offset, so a new search starts at the first page.
 * - A sortable header is a link to the same address sorted by it (`DataTable`), with a
 *   hidden hint that says the order and what the link does.
 * - The line over the table is a polite live region: after a search, a filter or a sort
 *   it says how many rows match and in what order, without moving focus. When what held
 *   focus has gone — a pager link, a row — focus lands on it (`AdminTableStatus`).
 * - More than one filter fold into "Filtros (n activos)" (`AdminFilters`).
 */
export function AdminTable({
  caption,
  columns,
  empty,
  filters = [],
  locale,
  noMatch,
  paging,
  pathname,
  query,
  rows,
  search,
  sort,
  total,
  words
}: AdminTableProps) {
  const owned = new Set([...(search ? ['q'] : []), ...filters.map(filter => filter.name), ...(paging ? ['size'] : []), ...TRANSIENT]);
  const kept = Object.entries(query).flatMap(([name, value]) =>
    owned.has(name) || value === undefined ? [] : (typeof value === 'string' ? [value] : value).map(one => [name, one] as const)
  );
  const values: Record<string, string> = search ? { q: search.value ?? '' } : {};

  for (const filter of filters) {
    values[filter.name] = filter.value ?? '';
  }

  if (paging) {
    values.size = String(paging.size);
  }

  const filtered = search?.value !== undefined || filters.some(filter => filter.value !== undefined);
  const clearHref = `${tableHref(pathname, query, Object.fromEntries([...owned].filter(name => name !== 'size').map(name => [name, undefined])))}#${ANCHOR}`;
  const sortedColumn = sort ? columns.find(column => column.sort?.value === sort.value) : undefined;

  const tableColumns: DataTableColumn[] = columns.map(({ sort: order, ...column }) => {
    if (!order) {
      return column;
    }

    const sorted = order.value === sort?.value ? sort.dir : undefined;
    const next = sorted === undefined ? order.first : sorted === 'asc' ? 'desc' : 'asc';
    const hint = sorted === 'asc' ? words.sortedAsc : sorted === 'desc' ? words.sortedDesc : next === 'asc' ? words.sortAsc : words.sortDesc;

    return {
      ...column,
      sorted,
      sortHint: hint,
      sortHref: `${tableHref(pathname, query, { abierta: undefined, dir: next, offset: undefined, sort: order.value })}#${ANCHOR}`
    };
  });

  const number = (value: number) => formatNumber(value, locale);
  const status = sort
    ? interpolate(words.status, {
        column: sortedColumn?.sort?.phrase ?? sort.value,
        count: number(total),
        direction: sort.dir === 'asc' ? words.ascending : words.descending
      })
    : interpolate(words.count, { count: number(total) });

  const pageHref = (offset: number) =>
    `${tableHref(pathname, query, { abierta: undefined, offset: offset > 0 ? String(offset) : undefined })}#${ANCHOR}`;
  const previousHref = paging && paging.offset > 0 ? pageHref(Math.max(paging.offset - paging.size, 0)) : undefined;
  const nextHref = paging && paging.offset + paging.size < total ? pageHref(paging.offset + paging.size) : undefined;
  const range =
    paging && rows.length > 0
      ? interpolate(words.range, { from: number(paging.offset + 1), to: number(paging.offset + rows.length), total: number(total) })
      : undefined;

  const active = filters.filter(filter => filter.value !== undefined).length;
  const filterFields = filters.map(filter =>
    filter.kind === 'date' ? (
      <Input defaultValue={filter.value ?? ''} key={filter.name} label={filter.label} name={filter.name} type="date" />
    ) : (
      <AdminFilter
        anyLabel={filter.anyLabel}
        key={filter.name}
        label={filter.label}
        name={filter.name}
        options={filter.options}
        value={filter.value ?? ''}
      />
    )
  );
  // What the table is now: the address and the rows on screen. See `AdminTableStatus`.
  const version = JSON.stringify([query, rows.map(row => row.id)]);

  return (
    <div className={styles.root} id={ANCHOR}>
      <AdminTableForm
        action={pathname}
        anchor={ANCHOR}
        className={styles.toolbar}
        label={search ? words.toolbar : words.toolbarFilters}
        searchable={search !== undefined}
        values={values}
      >
        {search ? (
          <Input className={styles.search} defaultValue={search.value ?? ''} label={search.label} maxLength={200} name="q" type="search" />
        ) : null}
        {/* One filter stays in the toolbar; more fold, so the toolbar fits a phone at large text. */}
        {filters.length > 1 ? (
          <AdminFilters
            active={active}
            summary={
              active === 0 ? words.filters : interpolate(active === 1 ? words.filtersActiveOne : words.filtersActive, { count: number(active) })
            }
          >
            {filterFields}
          </AdminFilters>
        ) : (
          filterFields
        )}
        {paging ? (
          <AdminFilter
            label={words.pageSize}
            name="size"
            options={PAGE_SIZES.map(size => ({ label: number(size), value: String(size) }))}
            value={String(paging.size)}
          />
        ) : null}
        {kept.map(([name, value]) => (
          <input defaultValue={value} key={`${name}=${value}`} name={name} type="hidden" />
        ))}
        <Button className={styles.apply} type="submit" variant="secondary">
          {words.apply}
        </Button>
      </AdminTableForm>

      <AdminTableStatus className={styles.status} version={version}>
        {status}
      </AdminTableStatus>

      {/* On a card, as the charts are: the pinned column paints the card's colour, which is what is under it. */}
      <Card className={styles.card}>
        <DataTable
          caption={caption}
          columns={tableColumns}
          empty={
            filtered ? (
              <Fragment>
                {noMatch}{' '}
                <Link className={styles.clear} href={clearHref}>
                  {search ? words.clear : words.clearFilters}
                </Link>
              </Fragment>
            ) : (
              empty
            )
          }
          hideCaption={true}
          rows={rows}
        />
      </Card>

      <AdminPager
        label={words.pager}
        nextHref={nextHref}
        nextLabel={words.next}
        previousHref={previousHref}
        previousLabel={words.previous}
        range={range}
      />
    </div>
  );
}
