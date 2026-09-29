import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { parsePeriod } from 'core/domain/Period';
import { StatTile } from 'ui/components/StatTile';
import { Text } from 'ui/components/Text';

import { AdminCountList } from 'components/AdminCountList';
import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../../consoleMetadata';
import { readCounts } from './planQualityView';

import type { AdminCountRow } from 'components/AdminCountList';
import type { AdminPlanQualityView } from 'core/controllers/Admin';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/producto/planes/calidad');
}

const PATHNAME = '/admin/producto/planes/calidad';

const MACROS = ['kcal', 'protein', 'carbs', 'fat'] as const;

/**
 * Producto › Planes › Calidad (`0071`): how the plans made in the period were delivered
 * against the owner's bar, summed over every plan (`0028`: never a plan, a day or a person).
 * Below the API's threshold it says "pocos datos" and shows no figure; it reads well with
 * no plans at all.
 */
export default async function AdminPlanQualityPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, quality] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminPlanQualityView>(`/admin/plans/quality?period=${period}`)
  ]);

  if (!quality) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminPlanQuality;
  const number = (value: number) => formatNumber(value, locale);
  const percent = (value: number | null) => (value === null ? '—' : formatNumber(value, locale, { maximumFractionDigits: 0, style: 'percent' }));
  const day = (iso: string) => formatDate(iso, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const counts = readCounts(quality);

  const tiles = (
    <ul aria-label={t.tilesLabel} className={styles.tiles}>
      <Card as="li" padding="sm">
        <StatTile label={t.tiles.plans} locale={locale} value={number(quality.plans)} />
      </Card>
      <Card as="li" padding="sm">
        <StatTile label={t.tiles.withoutQuality} locale={locale} note={t.withoutQualityNote} value={number(quality.withoutQuality)} />
      </Card>
    </ul>
  );

  const scoped = `${quality.dataStart === null ? t.noData : interpolate(t.dataSince, { date: day(quality.dataStart) })} ${t.untilYesterday}`;
  const notes = t.howCounted.map(note => interpolate(note, { min: number(quality.minPlans) }));

  if (counts === null) {
    return (
      <div className={styles.page}>
        <AdminPageHeader intro={t.intro} title={t.title}>
          <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
        </AdminPageHeader>

        <AdminSection note={scoped} title={t.tilesLabel}>
          <div className={styles.stack}>
            {tiles}
            <Card>
              <Text>{interpolate(t.few, { min: number(quality.minPlans), plans: number(quality.plans) })}</Text>
            </Card>
          </div>
        </AdminSection>

        <HowCounted notes={notes} summary={common.howCounted} />
      </div>
    );
  }

  const { days, floor, shares } = counts;
  const daysNote = (count: number, whole: number) => interpolate(t.daysOf, { count: number(count), days: number(whole) });

  const bandRows: AdminCountRow[] = [
    { id: 'all', count: percent(shares.inBand), label: t.inBandAll, status: daysNote(counts.daysInBand, days) },
    ...MACROS.map(macro => ({
      id: macro,
      count: percent(shares.inBandByMacro[macro]),
      label: t.macros[macro],
      status: daysNote(days - counts.missesByMacro[macro], days)
    })),
    { id: 'event', count: percent(shares.eventInBand), label: t.eventDays, status: daysNote(counts.eventDaysInBand, counts.eventDays) }
  ];

  const deliveryRows: AdminCountRow[] = [
    ...counts.fallbacks.map(row => ({ id: row.kind, count: number(row.n), label: t.fallbacks[row.kind] })),
    { id: 'loadsRefused', count: number(counts.loadsRefused), label: t.loadsRefused }
  ];

  const advisoryRows: AdminCountRow[] = counts.advisoriesByKind.map(row => ({
    id: row.kind,
    count: number(row.n),
    label: t.advisoryKinds[row.kind as keyof typeof t.advisoryKinds] ?? row.kind
  }));

  const floorLine =
    floor.since === null || floor.base.plans === 0
      ? t.floorNoData
      : floor.daysNarrowed === 0
        ? t.floorNone
        : interpolate(shares.floor?.restOutOfBand == null ? t.floorLineAlone : t.floorLine, {
            days: number(floor.daysNarrowed),
            narrowed: percent(shares.floor?.narrowedOutOfBand ?? null),
            rest: percent(shares.floor?.restOutOfBand ?? null)
          });

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      <AdminSection note={scoped} title={t.tilesLabel}>
        {tiles}
      </AdminSection>

      <AdminSection note={t.bandNote} title={t.bandTitle}>
        <AdminCountList label={t.bandLabel} rows={bandRows} />
      </AdminSection>

      <AdminSection note={t.deliveryNote} title={t.deliveryTitle}>
        <AdminCountList label={t.deliveryLabel} rows={deliveryRows} />
      </AdminSection>

      <AdminSection note={t.advisoriesNote} title={t.advisoriesTitle}>
        <AdminCountList label={t.advisoriesLabel} rows={advisoryRows} />
      </AdminSection>

      <AdminSection note={floor.since === null ? undefined : interpolate(t.floorSince, { date: day(floor.since) })} title={t.floorTitle}>
        <Card>
          <div className={styles.prose}>
            <p>{floorLine}</p>
            <Text size="sm" tone="secondary">
              {t.floorCaution}
            </Text>
          </div>
        </Card>
      </AdminSection>

      <HowCounted notes={notes} summary={common.howCounted} />
    </div>
  );
}
