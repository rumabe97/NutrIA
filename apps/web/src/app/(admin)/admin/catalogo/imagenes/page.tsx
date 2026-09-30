import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { DonutChart } from 'ui/components/DonutChart';
import { Gauge } from 'ui/components/Gauge';
import { LineChart } from 'ui/components/LineChart';
import { parsePeriod } from 'core/domain/Period';

import { AdminCountList } from 'components/AdminCountList';
import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';
import { PICTURE_REASONS } from 'core/entities/DishPicture';

import { formatDate, formatNumber, formatUsd, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { AdminCountRow } from 'components/AdminCountList';
import type { AdminPicturesPeriodView, PictureReasonCount } from 'core/controllers/Admin';
import type { ChartTone } from 'ui/types/Chart.types';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/catalogo/imagenes');
}

const PATHNAME = '/admin/catalogo/imagenes';

/** The states, in the order a picture goes through them, and the colour each keeps. */
const STATES = ['ready', 'drawing', 'failed', 'released'] as const;

const STATE_TONES: Readonly<Record<(typeof STATES)[number], ChartTone>> = { drawing: 'neutral', failed: 'failure', ready: 'success', released: 4 };

/**
 * Imágenes (`0066`, `0068`): this month's picture spend against the cap, what drawing
 * cost per day over the period, and every picture by the state it is in now — the ones
 * given back by the cap or the key included. The switch that turns drawing on or off
 * lives on Ajustes; this page says which way it is and links to it.
 *
 * Counts and dollars only: no dish, no person.
 */
export default async function AdminPicturesPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, pictures] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminPicturesPeriodView>(`/admin/pictures?period=${period}`)
  ]);

  if (!pictures) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminPictures;
  const dollars = (value: number) => formatUsd(value, locale);
  const monthStart = formatDate(pictures.since.slice(0, 10), locale, { day: 'numeric', month: 'long' });

  // The reasons are counts, not lists: Recetas filters by the failed state, not by reason, so
  // one link under the failed section opens those recipes and no row promises more.
  const reasonRows = (counts: readonly PictureReasonCount[]): readonly AdminCountRow[] =>
    counts.map(row => ({ id: row.reason, count: formatNumber(row.n, locale), label: t.reasons[row.reason] }));
  const reasonNotes = PICTURE_REASONS.map(reason => `${t.reasons[reason]}: ${t.reasonHelp[reason]}`);

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      <p className={styles.switch}>
        <span>{pictures.enabled ? t.settingsOn : t.settingsOff}</span>{' '}
        <Link className={styles.link} href="/admin/ajustes#imagenes">
          {t.settingsLink}
        </Link>
      </p>

      <AdminSection note={interpolate(t.gaugeNote, { date: monthStart })} title={t.gaugeTitle}>
        <Card>
          <Gauge
            cap={pictures.capUsd}
            capLabel={t.cap}
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.gaugeEmpty}
            formatValue={dollars}
            labelsHeader={t.gaugeTitle}
            locale={locale}
            overLabel={t.over}
            title={t.gaugeChart}
            value={pictures.spentUsd}
            valueLabel={t.spent}
          />
        </Card>
      </AdminSection>

      <AdminSection title={t.spendTitle}>
        <Card>
          <LineChart
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.spendEmpty}
            formatValue={dollars}
            labels={pictures.spendPerDay.days}
            labelsHeader={common.day}
            locale={locale}
            series={[{ name: t.spendSeries, values: pictures.spendPerDay.values }]}
            title={t.spendChart}
          />
        </Card>
      </AdminSection>

      <AdminSection note={t.statesNote} title={t.statesTitle}>
        <Card>
          <DonutChart
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.statesEmpty}
            labels={STATES.map(state => t.states[state])}
            labelsHeader={t.state}
            locale={locale}
            series={[{ name: t.statesSeries, values: STATES.map(state => pictures[state]) }]}
            shareHeader={t.share}
            title={t.statesChart}
            tones={STATES.map(state => STATE_TONES[state])}
          />
        </Card>
      </AdminSection>

      <AdminSection note={t.failedNote} title={t.failedTitle}>
        {pictures.failedByReason.length === 0 ? (
          <Card>
            <p className={styles.empty}>{t.failedEmpty}</p>
          </Card>
        ) : (
          <Fragment>
            <AdminCountList label={t.failedListLabel} rows={reasonRows(pictures.failedByReason)} />
            <p className={styles.more}>
              <Link className={styles.link} href="/admin/catalogo?picture=failed">
                {t.failedLink}
              </Link>
            </p>
          </Fragment>
        )}
      </AdminSection>

      <AdminSection note={t.releasedNote} title={t.releasedTitle}>
        {pictures.releasedByReason.length === 0 ? (
          <Card>
            <p className={styles.empty}>{t.releasedEmpty}</p>
          </Card>
        ) : (
          <AdminCountList label={t.releasedListLabel} rows={reasonRows(pictures.releasedByReason)} />
        )}
      </AdminSection>

      <HowCounted notes={[...t.howCounted, ...reasonNotes]} summary={common.howCounted} />
    </div>
  );
}
