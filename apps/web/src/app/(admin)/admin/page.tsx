import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { LineChart } from 'ui/components/LineChart';
import { parsePeriod } from 'core/domain/Period';
import { StatTile } from 'ui/components/StatTile';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';

import { formatDate, formatNumber, formatUsd, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from './consoleMetadata';
import { forwardOpened } from './forwardOpened';
import { RECORDING_STARTS } from './recordingStart';

import type { AdminSummaryView } from 'core/controllers/Admin';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin');
}

/**
 * Where each "needs you" row leads: the table it counts, already filtered. "Waiting"
 * is `activated=no`, which includes addresses not yet confirmed — the same count. The
 * failures are the last 24 hours' failed generations on Registro, as the row counts them.
 */
const NEEDS_YOU_HREF = {
  failed: '/admin/generacion?status=failed&since=24h',
  unread: '/admin/buzon?state=waiting',
  waiting: '/admin/cuentas?activated=no'
} as const;

/**
 * Resumen (`0068`): the period's headline figures against the period before, sign-ups
 * and generations per day, and what wants a hand now. Counts only — nobody's plan,
 * profile or food (`0028`).
 *
 * The API answers `/admin/summary` with a 404 to anybody but an admin, so a missing
 * answer is the same 404 here, whatever the gate above has done yet. Nothing on this
 * page redirects but `forwardOpened`, which asks the gate's question first.
 *
 * The mailed activation link lands here as `/admin?abierta=…` (the API's redirect, which
 * does not change) and is sent on to Cuentas, whose banner says which account was
 * opened.
 */
export default async function AdminSummaryPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;

  await forwardOpened(query);

  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, summary] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminSummaryView>(`/admin/summary?period=${period}`)
  ]);

  if (!summary) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const since = formatDate(RECORDING_STARTS, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const t = dictionary.adminSummary;
  const { charts, needsYou, tiles } = summary;
  const number = (value: number) => formatNumber(value, locale);
  const percent = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 0, style: 'percent' });
  const dollars = (value: number) => formatUsd(value, locale);
  const outcome = (key: string) => charts.generations.series.find(series => series.key === key)?.values ?? [];
  const pending = charts.generations.days.map((_, index) => (outcome('queued')[index] ?? 0) + (outcome('running')[index] ?? 0));
  const failedInPeriod = outcome('failed').reduce((total, value) => total + value, 0);
  const rate = tiles.successRate;
  const rateNote = [
    rate.current === null ? t.noneFinished : interpolate(t.failedInPeriod, { count: number(failedInPeriod) }),
    rate.previous === null ? null : interpolate(t.previousRate, { rate: percent(rate.previous) })
  ]
    .filter(Boolean)
    .join(' · ');
  const needs = [
    { count: needsYou.waitingAccounts, href: NEEDS_YOU_HREF.waiting, label: t.needsYou.waiting },
    { count: needsYou.unreadMessages, href: NEEDS_YOU_HREF.unread, label: t.needsYou.unread },
    { count: needsYou.failedGenerations, href: NEEDS_YOU_HREF.failed, label: t.needsYou.failed }
  ];

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname="/admin" query={query} />
      </AdminPageHeader>

      <ul aria-label={t.tilesLabel} className={styles.tiles}>
        <Card as="li" padding="sm">
          <StatTile label={t.totalAccounts} locale={locale} value={number(tiles.totalAccounts)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            change={tiles.newAccounts}
            changeLabel={common.changeLabel}
            goodDirection="up"
            label={t.newAccounts}
            locale={locale}
            sparkline={tiles.newAccounts.sparkline.values}
            value={number(tiles.newAccounts.current)}
          />
        </Card>
        <Card as="li" padding="sm">
          <StatTile label={t.waitingAccounts} locale={locale} value={number(tiles.waitingAccounts)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            change={tiles.activePeople}
            changeLabel={common.changeLabel}
            goodDirection="up"
            label={t.activePeople}
            locale={locale}
            sparkline={tiles.activePeople.sparkline.values}
            value={number(tiles.activePeople.current)}
          />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            change={tiles.plansGenerated}
            changeLabel={common.changeLabel}
            goodDirection="up"
            label={t.plansGenerated}
            locale={locale}
            sparkline={tiles.plansGenerated.sparkline.values}
            value={number(tiles.plansGenerated.current)}
          />
        </Card>
        {/* A rate moves in points, not in per cent of itself, so the tile states the
            previous rate rather than drawing a relative change. No finished job is
            "—", never 0 %. */}
        <Card as="li" padding="sm">
          <StatTile label={t.successRate} locale={locale} note={rateNote} value={rate.current === null ? '—' : percent(rate.current)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile label={t.unreadMessages} locale={locale} value={number(tiles.unreadMessages)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            change={tiles.pictures.spentUsd}
            changeLabel={common.changeLabel}
            label={t.pictureSpend}
            locale={locale}
            note={interpolate(t.pictureMonth, { cap: dollars(tiles.pictures.capUsd), spent: dollars(tiles.pictures.monthSpentUsd) })}
            value={dollars(tiles.pictures.spentUsd.current)}
          />
        </Card>
        {/* What the text models billed: the dishes for plans and the nightly step rewrites.
            Spend is neither good nor bad news on its own, so the change stays grey. */}
        <Card as="li" padding="sm">
          <StatTile
            change={tiles.textAi.spentUsd}
            changeLabel={common.changeLabel}
            label={t.textAiSpend}
            locale={locale}
            sparkline={tiles.textAi.sparkline.values}
            value={dollars(tiles.textAi.spentUsd.current)}
          />
        </Card>
      </ul>

      <AdminSection title={t.needsYou.title}>
        <Card as="ul" className={styles.needs}>
          {needs.map(row => (
            <li key={row.href}>
              <Link className={styles.need} href={row.href}>
                <span className={styles.needLabel}>{row.label}</span>
                <span className={styles.needCount} data-zero={row.count === 0 ? 'true' : undefined}>
                  {number(row.count)}
                </span>
                <svg aria-hidden="true" className={styles.needChevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </Card>
      </AdminSection>

      <AdminSection title={t.trendsTitle}>
        <div className={styles.charts}>
          <Card>
            <LineChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.signUpsEmpty}
              labels={charts.signUps.days}
              labelsHeader={common.day}
              locale={locale}
              series={[{ name: t.signUpsSeries, values: charts.signUps.values }]}
              title={t.signUpsChart}
            />
          </Card>
          <Card>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.generationsEmpty}
              labels={charts.generations.days}
              labelsHeader={common.day}
              locale={locale}
              series={[
                { name: t.outcomes.succeeded, tone: 'success', values: outcome('succeeded') },
                { name: t.outcomes.failed, tone: 'failure', values: outcome('failed') },
                { name: t.outcomes.pending, tone: 'neutral', values: pending }
              ]}
              stacked={true}
              title={t.generationsChart}
              totalLabel={t.total}
            />
          </Card>
        </div>
      </AdminSection>

      <HowCounted notes={t.howCounted.map(note => interpolate(note, { date: since }))} summary={common.howCounted} />
    </div>
  );
}
