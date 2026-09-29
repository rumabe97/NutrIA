import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { BarChart } from 'ui/components/BarChart';
import { LineChart } from 'ui/components/LineChart';
import { parsePeriod } from 'core/domain/Period';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';
import { RECORDING_STARTS } from '../recordingStart';

import type { AdminProductView } from 'core/controllers/Admin';
import type { ChartTone } from 'ui/types/Chart.types';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/producto');
}

/** The order people actually move through, so each step can say what share of the one above it got here. */
const FUNNEL_STAGES = ['signedUp', 'confirmed', 'activated', 'onboarded', 'planned', 'lived', 'checkedIn', 'returned'] as const;

/** Each event keeps its colour whatever else is charted beside it: colour follows the event, not its place. */
const EVENT_TONES: Readonly<Record<string, ChartTone>> = { app_used: 3, session_started: 1, swap_requested: 2 };

/**
 * Embudo y actividad (`0068`): how far people get, counted from state over every
 * account there has been, and who came back and what they did, per day in the
 * period. Counts only (`0028`).
 *
 * The funnel does not follow the period — the page says so under its heading, so
 * the selector above it is not read as changing it.
 */
export default async function AdminProductPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, product] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminProductView>(`/admin/product?period=${period}`)
  ]);

  if (!product) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const since = formatDate(RECORDING_STARTS, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const t = dictionary.adminProduct;
  const events = dictionary.admin.events;
  const reached = FUNNEL_STAGES.map(stage => product.funnel[stage]);
  // The first step has nothing above it; a step whose predecessor is empty has no share either.
  const shares = reached.map((value, index) => {
    const previous = index === 0 ? 0 : (reached[index - 1] ?? 0);

    return previous > 0 ? formatNumber(value / previous, locale, { maximumFractionDigits: 0, style: 'percent' }) : undefined;
  });

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname="/admin/producto" query={query} />
      </AdminPageHeader>

      <AdminSection note={t.funnelNote} title={t.funnelTitle}>
        <Card>
          <BarChart
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.funnelEmpty}
            labels={FUNNEL_STAGES.map(stage => dictionary.admin.funnel[stage])}
            labelsHeader={t.funnelStep}
            locale={locale}
            series={[{ name: t.funnelSeries, values: reached }]}
            shares={{ header: t.funnelShare, values: shares }}
            title={t.funnelChart}
          />
        </Card>
      </AdminSection>

      <AdminSection title={t.activityTitle}>
        <div className={styles.charts}>
          <Card>
            <LineChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.activeEmpty}
              labels={product.activePeople.days}
              labelsHeader={common.day}
              locale={locale}
              series={[{ name: t.activeSeries, values: product.activePeople.values }]}
              title={t.activeChart}
            />
          </Card>
          <Card>
            <LineChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.eventsEmpty}
              labels={product.events.days}
              labelsHeader={common.day}
              locale={locale}
              series={product.events.series.map(series => ({
                name: events[series.key as keyof typeof events] ?? series.key,
                tone: EVENT_TONES[series.key],
                values: series.values
              }))}
              title={t.eventsChart}
            />
          </Card>
        </div>
      </AdminSection>

      <HowCounted notes={t.howCounted.map(note => interpolate(note, { date: since }))} summary={common.howCounted} />
    </div>
  );
}
