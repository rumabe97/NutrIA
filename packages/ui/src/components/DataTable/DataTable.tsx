import { useId } from 'react';

import styles from './DataTable.module.css';

import { Link } from 'ui/components/Link';

import { SortIcon } from './components/SortIcon';

import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface DataTableColumn {
  /** Which cell of each row goes in this column. */
  readonly align?: 'end' | 'start';
  /** Column header text. */
  readonly header: string;
  /** Key into each row's `cells`. */
  readonly key: string;
  /** The column the rows are sorted by, and which way. At most one column sets it. */
  readonly sorted?: 'asc' | 'desc';
  /**
   * Read after the header inside its sort link, never shown: the current order and what
   * following the link does ("orden ascendente; ordenar de forma descendente"). A changed
   * `aria-sort` is not announced by most screen readers, and the link keeps focus after a
   * sort, so this is what tells somebody the order changed.
   */
  readonly sortHint?: string;
  /** Where the header link goes to sort by this column. Omit for a column that does not sort. */
  readonly sortHref?: string;
}

export interface DataTableRow {
  /** Stable key for the row. */
  readonly id: string;
  /** One cell per column key. A missing key renders an empty cell. */
  readonly cells: Readonly<Record<string, ReactNode>>;
}

export interface DataTableProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  /** **Required.** The table's `<caption>`, and the name of its scroll region. */
  caption: string;
  /** Column definitions, in order. The first column is the row header and stays put when the table scrolls sideways. */
  columns: readonly DataTableColumn[];
  /** **Required.** What the body says when there are no rows. */
  empty: ReactNode;
  /** Hides the caption visually; it still names the table and the region. For a table whose heading is already on screen. */
  hideCaption?: boolean;
  /** The rows, already sorted and paged. */
  rows: readonly DataTableRow[];
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

/**
 * A plain table: no state, no fetching, no sorting of its own.
 *
 * Sorting is the page's: a sortable header is a link to the same page sorted by that
 * column, so it works without JavaScript and the address says what is shown. The
 * table sits in a focusable, named region that scrolls sideways on a narrow screen,
 * with the first column held in place so each row keeps its name.
 */
export function DataTable({ caption, className, columns, empty, hideCaption, rows, ...rest }: DataTableProps) {
  const captionId = useId();

  return (
    // A focusable region is how a keyboard scrolls a wide table (WCAG 2.1.1); its name is the caption.
    <div aria-labelledby={captionId} className={[styles.region, className].filter(Boolean).join(' ')} role="region" tabIndex={0} {...rest}>
      <table className={styles.table}>
        <caption className={hideCaption ? 'visually-hidden' : styles.caption} id={captionId}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                aria-sort={column.sorted ? ARIA_SORT[column.sorted] : undefined}
                className={column.align === 'end' ? styles.end : undefined}
                key={column.key}
                scope="col"
              >
                {column.sortHref ? (
                  <Link className={styles.sort} href={column.sortHref}>
                    {column.header}
                    {column.sortHint ? <span className="visually-hidden">{`, ${column.sortHint}`}</span> : null}
                    <SortIcon sorted={column.sorted} />
                  </Link>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={Math.max(columns.length, 1)}>
                <div className={styles.emptyContent}>{empty}</div>
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr key={row.id}>
                {columns.map((column, index) => {
                  const className = column.align === 'end' ? styles.end : undefined;

                  return index === 0 ? (
                    <th className={className} key={column.key} scope="row">
                      {row.cells[column.key]}
                    </th>
                  ) : (
                    <td className={className} key={column.key}>
                      {row.cells[column.key]}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
