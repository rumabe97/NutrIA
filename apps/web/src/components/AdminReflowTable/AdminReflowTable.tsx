import { useId } from 'react';

import Link from 'next/link';

import styles from './AdminReflowTable.module.css';

import { DataTable } from 'ui/components/DataTable';

import { Card } from 'components/Card';

import type { DataTableColumn, DataTableRow } from 'ui/components/DataTable';
import type { ReactNode } from 'react';

/** The column whose cell is the row's actions: on a phone it ends the card, under no name of its own. */
const ACTIONS_KEY = 'actions';

interface AdminReflowTableProps {
  /** Names the table and, below the breakpoint, the list that replaces it. */
  caption: string;
  columns: readonly DataTableColumn[];
  empty: ReactNode;
  rows: readonly DataTableRow[];
  /** Draws the caption as a heading above the table, for a table whose section has no heading of its own. */
  showCaption?: boolean;
  /** Names the list of sort links a sortable table keeps on a phone, where its header row is not drawn ("Ordenar por"). */
  sortLabel?: string;
}

/**
 * A console table that reflows instead of scrolling (`0071`, project 024 phase 8): on a card
 * wide enough it is the `DataTable` — the first column pinned, and a shadow at the edge that
 * has more behind it; on a narrow one every row is a block, the row header as its title, every
 * other cell under its column's name and the row's actions last, so no figure is left behind a
 * sideways scroll. A table that sorts keeps its sort links above the blocks. Both forms are in
 * the markup and the container query shows one, so each keeps its own semantics (a table stays
 * a table; the narrow form is a list of definition lists).
 */
export function AdminReflowTable({ caption, columns, empty, rows, showCaption = false, sortLabel }: AdminReflowTableProps) {
  const captionId = useId();
  const [head, ...rest] = columns;
  const fields = rest.filter(column => column.key !== ACTIONS_KEY);
  const actions = rest.find(column => column.key === ACTIONS_KEY);
  const sortable = columns.filter(column => column.sortHref !== undefined);

  return (
    <Card className={styles.card}>
      {showCaption ? (
        <h3 className={styles.caption} id={captionId}>
          {caption}
        </h3>
      ) : null}
      <div className={styles.wide}>
        <DataTable caption={caption} columns={columns} empty={empty} hideCaption={true} rows={rows} />
      </div>
      <div className={styles.narrow}>
        {sortable.length > 0 ? (
          <nav aria-label={sortLabel ?? caption} className={styles.sort}>
            <span aria-hidden="true" className={styles.sortLabel}>
              {sortLabel}
            </span>
            <ul className={styles.sortList}>
              {sortable.map(column => (
                <li key={column.key}>
                  <Link aria-current={column.sorted ? 'true' : undefined} className={styles.sortLink} href={column.sortHref ?? ''}>
                    {column.header}
                    {column.sorted ? <span aria-hidden="true">{column.sorted === 'asc' ? ' ↑' : ' ↓'}</span> : null}
                    {column.sortHint ? <span className="visually-hidden">{`, ${column.sortHint}`}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {rows.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : (
          <ul aria-label={showCaption ? undefined : caption} aria-labelledby={showCaption ? captionId : undefined} className={styles.list}>
            {rows.map(row => (
              <li className={styles.item} data-compact={fields.length === 1 && !actions ? 'true' : undefined} key={row.id}>
                <p className={styles.title}>{head ? row.cells[head.key] : null}</p>
                <dl className={styles.values}>
                  {fields.map(column => (
                    <div className={styles.value} key={column.key}>
                      <dt>{column.header}</dt>
                      <dd>{row.cells[column.key]}</dd>
                    </div>
                  ))}
                </dl>
                {actions ? <div className={styles.actions}>{row.cells[actions.key]}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
