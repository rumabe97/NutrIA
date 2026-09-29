import { Fragment } from 'react';

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { parsePeriod } from 'core/domain/Period';
import { StatTile } from 'ui/components/StatTile';

import { AdminCountList } from 'components/AdminCountList';
import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminReflowTable } from 'components/AdminReflowTable';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';

import { formatDate, formatNumber, formatUsd, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { AdminCatalogueQualityView } from 'core/controllers/Admin';
import type { AdminCountRow } from 'components/AdminCountList';
import type { DataTableRow } from 'ui/components/DataTable';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';
import type { RecipeCheck } from 'core/entities/AdminQuery';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/catalogo/calidad');
}

const PATHNAME = '/admin/catalogo/calidad';

const RECIPES = '/admin/catalogo';

/** The checks that are a count of recipes, in the order the page lists them, and the filter each opens Recetas with. */
const ZERO_CHECKS = [
  ['overBound', 'over_bound'],
  ['uncosted', 'uncosted'],
  ['unserved', 'unserved'],
  ['refusalLimit', 'refusal_limit']
] as const satisfies readonly (readonly [keyof AdminCatalogueQualityView['shouldBeZero'], RecipeCheck])[];

/**
 * Catálogo › Calidad (`0071`): what the catalogue should satisfy and does not, each count
 * opening Recetas with exactly the recipes counted; what is worth a look; and where the
 * step rewrite stands. The catalogue is shared reference data (`0028`): nothing here names
 * a person, a plan or a meal. The period drives only the size rejections.
 */
export default async function AdminQualityPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, quality] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminCatalogueQualityView>(`/admin/catalogue/quality?period=${period}`)
  ]);

  if (!quality) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminQuality;
  const sources = dictionary.adminRecipes.sources;
  const number = (value: number) => formatNumber(value, locale);
  const { shouldBeZero, sweep, toLookAt } = quality;
  const warning = (count: number) => (count > 0 ? { status: t.status.warn, warn: true } : { status: t.status.ok });

  const zeroRows: AdminCountRow[] = [
    ...ZERO_CHECKS.map(([key, check]) => ({
      id: key,
      count: number(shouldBeZero[key]),
      href: shouldBeZero[key] > 0 ? `${RECIPES}?check=${check}` : undefined,
      label: t.zero[key],
      ...warning(shouldBeZero[key])
    })),
    {
      id: 'mealsOutsideServingBounds',
      count: number(shouldBeZero.mealsOutsideServingBounds),
      label: t.zero.mealsOutsideServingBounds,
      ...warning(shouldBeZero.mealsOutsideServingBounds)
    }
  ];

  const lookRows: AdminCountRow[] = [
    ...toLookAt.overCapBySource.map(row => ({
      id: `overCap-${row.source}`,
      count: number(row.n),
      href: row.n > 0 ? `${RECIPES}?check=over_cap&source=${row.source}` : undefined,
      label: `${t.overCapBySource}: ${sources[row.source as keyof typeof sources] ?? row.source}`
    })),
    {
      id: 'picturesFailed',
      count: number(toLookAt.picturesFailed),
      href: toLookAt.picturesFailed > 0 ? `${RECIPES}?picture=failed` : undefined,
      label: t.picturesFailed
    }
  ];

  const { sweepHistory: history } = quality;
  const dollars = (value: number) => formatUsd(value, locale);
  const noData = (
    <Fragment>
      <span aria-hidden="true">—</span>
      <span className="visually-hidden">{t.historyNoData}</span>
    </Fragment>
  );
  const historyRows: DataTableRow[] = history.days.flatMap((day, index) => {
    const runs = history.runs[index] ?? 0;
    const calls = history.calls[index] ?? 0;
    const pending = history.pending[index];

    if (runs === 0 && calls === 0) {
      return [];
    }

    return [
      {
        id: day,
        cells: {
          calls: number(calls),
          cost: dollars(history.costUsd[index] ?? 0),
          day: formatDate(day, locale, { day: 'numeric', month: 'short' }),
          heldByCap: number(history.heldByCap[index] ?? 0),
          pending: pending === null || pending === undefined ? noData : number(pending),
          rewritten: number(history.rewritten[index] ?? 0),
          runs: number(runs),
          skipped: number(history.skipped[index] ?? 0),
          unreached: number(history.unreached[index] ?? 0)
        }
      }
    ];
  });

  const sweepTiles = [
    ['current', sweep.current],
    ['pending', sweep.pending],
    ['withRefusals', sweep.withRefusals],
    ['givenUp', sweep.givenUp]
  ] as const;

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      <AdminSection note={t.zeroNote} title={t.zeroTitle}>
        <AdminCountList label={t.zeroLabel} rows={zeroRows} />
      </AdminSection>

      <AdminSection note={t.lookNote} title={t.lookTitle}>
        <div className={styles.stack}>
          <AdminCountList label={t.lookLabel} rows={lookRows} />
          <Card>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.lookEmpty}
              labels={toLookAt.oversizedRejections.days}
              labelsHeader={common.day}
              locale={locale}
              series={[{ name: t.lookSeries, values: toLookAt.oversizedRejections.values }]}
              title={t.lookChart}
            />
          </Card>
        </div>
      </AdminSection>

      <AdminSection note={interpolate(t.sweepNote, { bound: sweep.attemptBound, version: sweep.stepsVersion })} title={t.sweepTitle}>
        <ul aria-label={t.tilesLabel} className={styles.tiles}>
          {sweepTiles.map(([key, value]) => (
            <Card as="li" key={key} padding="sm">
              <StatTile
                label={t.sweep[key]}
                locale={locale}
                note={interpolate(t.sweepOf, { total: number(quality.recipes) })}
                value={number(value)}
              />
            </Card>
          ))}
        </ul>
      </AdminSection>

      <AdminSection note={t.historyNote} title={t.historyTitle}>
        <div className={styles.stack}>
          <Card>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.historyEmpty}
              labels={history.days}
              labelsHeader={common.day}
              locale={locale}
              series={[
                { name: t.historySeries.rewritten, tone: 'success', values: history.rewritten },
                { name: t.historySeries.skipped, tone: 'neutral', values: history.skipped },
                { name: t.historySeries.unreached, tone: 2, values: history.unreached },
                { name: t.historySeries.heldByCap, tone: 1, values: history.heldByCap }
              ]}
              stacked={true}
              title={t.historyChart}
              totalLabel={t.historyTotal}
            />
          </Card>
          <Card>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.historyEmpty}
              formatValue={dollars}
              labels={history.days}
              labelsHeader={common.day}
              locale={locale}
              series={[{ name: t.historyCostSeries, values: history.costUsd }]}
              title={t.historyCostChart}
            />
          </Card>
          <AdminReflowTable
            caption={t.historyRunsCaption}
            columns={[
              { header: common.day, key: 'day' },
              { align: 'end', header: t.historyRunsHeader, key: 'runs' },
              { align: 'end', header: t.historySeries.rewritten, key: 'rewritten' },
              { align: 'end', header: t.historySeries.skipped, key: 'skipped' },
              { align: 'end', header: t.historySeries.unreached, key: 'unreached' },
              { align: 'end', header: t.historySeries.heldByCap, key: 'heldByCap' },
              { align: 'end', header: t.historyPending, key: 'pending' },
              { align: 'end', header: t.historyCalls, key: 'calls' },
              { align: 'end', header: t.historyCost, key: 'cost' }
            ]}
            empty={t.historyRunsEmpty}
            rows={historyRows}
            showCaption={true}
          />
        </div>
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
