import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { parsePeriod } from 'core/domain/Period';
import { StatTile } from 'ui/components/StatTile';

import { AdminCountList } from 'components/AdminCountList';
import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';

import { formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { AdminCatalogueQualityView } from 'core/controllers/Admin';
import type { AdminCountRow } from 'components/AdminCountList';
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
          <AdminCountList label={t.lookTitle} rows={lookRows} />
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

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
