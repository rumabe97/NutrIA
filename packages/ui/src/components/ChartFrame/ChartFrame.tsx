import styles from './ChartFrame.module.css';

import { DataTable } from 'ui/components/DataTable';

import { ChartLegend } from './components/ChartLegend';

import type { ChartLegendItem } from './components/ChartLegend';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import type { DataTableColumn, DataTableRow } from 'ui/components/DataTable';

export interface ChartFrameTable {
  /** Columns after the first (the labels'), one per series, plus any total. */
  readonly columns: readonly string[];
  /** Header of the first column. */
  readonly labelsHeader: string;
  /** One row per label: its text and one already formatted figure per column. */
  readonly rows: readonly { readonly cells: readonly string[]; readonly label: string }[];
}

export interface ChartFrameProps extends Omit<ComponentPropsWithRef<'figure'>, 'children' | 'title'> {
  /** The plot: an `<svg role="img" aria-labelledby={titleId}>`. Not drawn when `empty`. */
  children: ReactNode;
  /** **Required.** Text of the "show data" disclosure. */
  dataLabel: string;
  /** Draw `emptyLabel` in place of the plot and the table. */
  empty: boolean;
  /** **Required.** What an empty chart says. */
  emptyLabel: string;
  /** `beside` puts the legend next to the plot, for a donut; it wraps under it on a narrow screen. Defaults to `stacked`: the legend above. */
  layout?: 'beside' | 'stacked';
  /** Legend entries. Drawn when given and not empty; a chart passes them for two series or more. */
  legend?: readonly ChartLegendItem[];
  /** The same figures the plot draws, for the disclosure. */
  table: ChartFrameTable;
  /** **Required.** The visible caption. */
  title: string;
  /** Id for the caption, so the plot can name itself with `aria-labelledby`. */
  titleId: string;
}

/**
 * What every chart is drawn in (`0069`): a `<figure>` whose caption names the plot, a
 * legend when there is more than one series, and a "show data" disclosure with the
 * same figures as a table — so no number lives only in a shape.
 *
 * An empty chart says so in words instead of drawing a flat line that looks like data.
 * The frame is a size container, which is how a chart drops labels on a narrow screen
 * without measuring itself; `--chart-surface` is the colour under it, used for the gaps
 * between marks and the halo behind axis labels.
 */
export function ChartFrame({
  children,
  className,
  dataLabel,
  empty,
  emptyLabel,
  layout = 'stacked',
  legend,
  table,
  title,
  titleId,
  ...rest
}: ChartFrameProps) {
  const columns: DataTableColumn[] = [
    { header: table.labelsHeader, key: 'label' },
    ...table.columns.map((header, index) => ({ align: 'end' as const, header, key: `c${index}` }))
  ];
  const rows: DataTableRow[] = table.rows.map((row, index) => ({
    id: `${index}`,
    cells: { label: row.label, ...Object.fromEntries(row.cells.map((cell, column) => [`c${column}`, cell])) }
  }));

  const legendView = legend && legend.length > 0 ? <ChartLegend direction={layout === 'beside' ? 'column' : 'row'} items={legend} /> : null;

  return (
    <figure aria-labelledby={titleId} className={[styles.root, className].filter(Boolean).join(' ')} {...rest}>
      <figcaption className={styles.title} id={titleId}>
        {title}
      </figcaption>
      {empty ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <div className={layout === 'beside' ? `${styles.body} ${styles.beside}` : styles.body}>
          {layout === 'stacked' ? legendView : null}
          {children}
          {layout === 'beside' ? legendView : null}
          <details className={styles.data}>
            <summary className={styles.summary}>
              <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 16 16">
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {dataLabel}
            </summary>
            <DataTable caption={title} className={styles.table} columns={columns} empty={emptyLabel} hideCaption={true} rows={rows} />
          </details>
        </div>
      )}
    </figure>
  );
}
