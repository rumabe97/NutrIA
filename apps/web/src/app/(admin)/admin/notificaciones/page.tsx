import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { parsePeriod } from 'core/domain/Period';
import { StatTile } from 'ui/components/StatTile';

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

import type { AdminNotificationsView } from 'core/controllers/Admin';
import type { ChartTone } from 'ui/types/Chart.types';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/notificaciones');
}

const PATHNAME = '/admin/notificaciones';

/** Each channel keeps its colour whatever else is charted beside it. */
const CHANNEL_TONES: Readonly<Record<string, ChartTone>> = { email: 1, push: 2 };

/**
 * Producto › Notificaciones (`0071`): who can be reached by push, the check-in reminders
 * sent per week and channel, and how many of the people reminded made a check-in within
 * three days. Counts only (`0028`): no subscription address and no name.
 *
 * The push totals do not follow the period; the page says nothing else than what it counts.
 */
export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, notifications] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminNotificationsView>(`/admin/notifications?period=${period}`)
  ]);

  if (!notifications) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminNotifications;
  const number = (value: number) => formatNumber(value, locale);
  const since = formatDate(RECORDING_STARTS, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const { checkIns, push, remindersPerWeek } = notifications;
  const share =
    checkIns.reminded > 0 ? formatNumber(checkIns.answered / checkIns.reminded, locale, { maximumFractionDigits: 0, style: 'percent' }) : null;

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      <ul aria-label={t.tilesLabel} className={styles.tiles}>
        <Card as="li" padding="sm">
          <StatTile label={t.subscriptions} locale={locale} value={number(push.subscriptions)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile label={t.people} locale={locale} value={number(push.people)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile label={t.reminded} locale={locale} value={number(checkIns.reminded)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            label={t.answered}
            locale={locale}
            note={share === null ? undefined : interpolate(t.answeredNote, { share })}
            value={number(checkIns.answered)}
          />
        </Card>
      </ul>

      <AdminSection title={t.remindersTitle}>
        <Card>
          <ColumnChart
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.remindersEmpty}
            labels={remindersPerWeek.weeks}
            labelsHeader={common.week}
            locale={locale}
            series={remindersPerWeek.series.map(series => ({
              name: t.remindersChannels[series.channel as keyof typeof t.remindersChannels] ?? series.channel,
              tone: CHANNEL_TONES[series.channel],
              values: series.values
            }))}
            title={t.remindersChart}
          />
        </Card>
      </AdminSection>

      <HowCounted notes={t.howCounted.map(note => interpolate(note, { date: since }))} summary={common.howCounted} />
    </div>
  );
}
