import { Fragment } from 'react';

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminReflowTable } from 'components/AdminReflowTable';
import { AdminSection } from 'components/AdminSection';
import { HowCounted } from 'components/HowCounted';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { DataTableRow } from 'ui/components/DataTable';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { RetentionCohortView, RetentionPageView } from './retentionView';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/personas/retencion');
}

/**
 * The first day every column of "Usó la app" can hold a cohort: the events start on
 * 2026-09-29 and the four-week column needs its week to be over. Said on the page
 * because until then those cells are "—" and look like a fault.
 */
const USED_THE_APP_FILLS_FROM = '2026-10-06';

/**
 * Personas › Retención (`0071`): sign-up cohorts and how many of them were active one, two
 * and four weeks later, monthly, in two readings stacked under one another. Counts of
 * people, as "active / eligible"; a cell is null ("—") below `minCohort` people, and a share shows only above it; no name, no id and no
 * link from any cell (`0028`). Empty and half-filled cohorts read as "—", not as zero.
 */
export default async function AdminRetentionPage() {
  const [dictionary, locale, retention] = await Promise.all([getDictionary(), activeLocale(), serverApi<RetentionPageView>('/admin/retention')]);

  if (!retention) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminRetention;
  const number = (value: number) => formatNumber(value, locale);
  const min = number(retention.minCohort);

  /** A dash for the eye and a reason for a screen reader: too few people, or a week not lived yet. */
  const noFigure = (reason: string) => (
    <Fragment>
      <span aria-hidden="true">—</span>
      <span className="visually-hidden">{reason}</span>
    </Fragment>
  );
  const tooFew = () => noFigure(interpolate(t.tooFew, { min }));
  const day = (iso: string) => formatDate(iso, locale, { day: 'numeric', month: 'long', year: 'numeric' });

  const cohortName = (start: string) => formatDate(start, locale, { month: 'long', year: 'numeric' });

  const cell = (entry: RetentionCohortView['cells'][number]): ReactNode => {
    if (entry !== null && entry.eligible === 0) {
      return noFigure(t.notYet);
    }

    if (entry === null || entry.active === null || entry.eligible === null) {
      return tooFew();
    }

    const counts = `${number(entry.active)} / ${number(entry.eligible)}`;

    // A share only from `minCohort` people, and never a link: a cell is a count.
    return entry.enough
      ? `${counts} · ${formatNumber(entry.active / entry.eligible, locale, { maximumFractionDigits: 0, style: 'percent' })}`
      : counts;
  };

  const columns = [
    { header: t.cohort, key: 'cohort' },
    { align: 'end' as const, header: t.size, key: 'size' },
    ...retention.weeks.map(weeks => ({ align: 'end' as const, header: interpolate(t.week, { weeks }), key: `week-${weeks}` }))
  ];

  const rowsOf = (cohorts: readonly RetentionCohortView[]): DataTableRow[] =>
    cohorts.some(cohort => cohort.size !== 0)
      ? cohorts.map(cohort => ({
          id: cohort.start,
          cells: {
            cohort: cohortName(cohort.start),
            size: cohort.size === null ? tooFew() : number(cohort.size),
            ...Object.fromEntries(
              retention.weeks.map((weeks, index) => [
                `week-${weeks}`,
                cell(cohort.cells.find(entry => entry?.weeks === weeks) ?? cohort.cells[index] ?? null)
              ])
            )
          }
        }))
      : [];

  const notes = t.howCounted.map(note => interpolate(note, { min, since: day(retention.eventsSince) }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />

      <Text size="sm" tone="secondary">
        {interpolate(t.hidden, { min })}
      </Text>

      <AdminSection note={t.didNote} title={t.didTitle}>
        <AdminReflowTable caption={t.didTable} columns={columns} empty={t.empty} rows={rowsOf(retention.didSomething)} />
      </AdminSection>

      <AdminSection note={interpolate(t.usedNote, { from: day(USED_THE_APP_FILLS_FROM), since: day(retention.eventsSince) })} title={t.usedTitle}>
        <AdminReflowTable caption={t.usedTable} columns={columns} empty={t.empty} rows={rowsOf(retention.usedTheApp)} />
      </AdminSection>

      <HowCounted notes={notes} summary={common.howCounted} />
    </div>
  );
}
