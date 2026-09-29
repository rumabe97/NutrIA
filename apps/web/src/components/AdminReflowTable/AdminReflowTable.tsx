import { useId } from 'react';

import styles from './AdminReflowTable.module.css';

import { DataTable } from 'ui/components/DataTable';

import { Card } from 'components/Card';

import type { DataTableColumn, DataTableRow } from 'ui/components/DataTable';

interface AdminReflowTableProps {
  /** Names the table and, below the breakpoint, the list that replaces it. */
  caption: string;
  columns: readonly DataTableColumn[];
  empty: string;
  rows: readonly DataTableRow[];
  /** Draws the caption as a heading above the table, for a table whose section has no heading of its own. */
  showCaption?: boolean;
}

/**
 * A console table that reflows instead of scrolling (`0071`): on a card wide enough it is
 * the `DataTable`; on a narrow one each row becomes a block, the row header as its title and
 * every other cell under its column's name, so no figure is left behind a sideways scroll.
 * Both are in the markup and the container query shows one, so each keeps its own semantics
 * (a table stays a table; the narrow form is a list of definition lists).
 */
export function AdminReflowTable({ caption, columns, empty, rows, showCaption = false }: AdminReflowTableProps) {
  const captionId = useId();
  const [head, ...rest] = columns;

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
        {rows.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : (
          <ul aria-label={showCaption ? undefined : caption} aria-labelledby={showCaption ? captionId : undefined} className={styles.list}>
            {rows.map(row => (
              <li className={styles.item} key={row.id}>
                <p className={styles.title}>{head ? row.cells[head.key] : null}</p>
                <dl className={styles.values}>
                  {rest.map(column => (
                    <div className={styles.value} key={column.key}>
                      <dt>{column.header}</dt>
                      <dd>{row.cells[column.key]}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
