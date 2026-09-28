import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { DonutChart } from 'ui/components/DonutChart';
import { parsePeriod } from 'core/domain/Period';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';

import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../../_shared/metadata';

import type { AdminPlansView } from 'core/controllers/Admin';
import type { ChartTone } from 'ui/types/Chart.types';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/admin/producto/planes');
}

/**
 * A colour per state, pinned so a state keeps its colour whichever others are empty.
 * Six states take the six categorical slots; `failed` is an outcome and wears the
 * failure tone, so the seventh never falls to grey.
 */
const STATE_TONES: Readonly<Record<string, ChartTone>> = {
  active: 1,
  archived: 5,
  completed: 2,
  draft: 4,
  failed: 'failure',
  generating: 3,
  pending_review: 6
};

/**
 * Planes (`0068`): every plan by the state it is in now — all of them, not the
 * period's, which the section says — and plans made per day in the period. Counts
 * only (`0028`).
 */
export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, plans] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminPlansView>(`/admin/plans?period=${period}`)
  ]);

  if (!plans) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminPlans;

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname="/admin/producto/planes" query={query} />
      </AdminPageHeader>

      <AdminSection note={t.byStateNote} title={t.byStateTitle}>
        <Card>
          <DonutChart
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.byStateEmpty}
            labels={plans.byState.map(row => t.states[row.status as keyof typeof t.states] ?? row.status)}
            labelsHeader={t.state}
            locale={locale}
            series={[{ name: t.series, values: plans.byState.map(row => row.n) }]}
            shareHeader={t.share}
            title={t.byStateChart}
            tones={plans.byState.map(row => STATE_TONES[row.status])}
          />
        </Card>
      </AdminSection>

      <AdminSection title={t.createdTitle}>
        <Card>
          <ColumnChart
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.createdEmpty}
            labels={plans.created.days}
            labelsHeader={common.day}
            locale={locale}
            series={[{ name: t.series, values: plans.created.values }]}
            title={t.createdChart}
          />
        </Card>
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
