import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { BarChart } from 'ui/components/BarChart';
import { LOCALES } from 'i18n/config';
import { StatTile } from 'ui/components/StatTile';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { RETRY_STATUS_ID, RetryPictureButton } from 'components/RetryPictureButton';

import { MEAL_SLOTS } from 'core/entities/Plan';
import { RECIPE_CHECKS, RECIPE_SOURCES, recipeCatalogueQuerySchema } from 'core/entities/AdminQuery';

import { formatInstant, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AdminRecipesView, CatalogueRecipeView } from 'core/controllers/Admin';
import type { AdminTableColumn, AdminTableFilter } from 'components/AdminTable';
import type { Allergen } from 'core/entities/Safety';
import type { MealSlot } from 'core/entities/Plan';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/catalogo');
}

const PATHNAME = '/admin/catalogo';

/** The picture states a recipe can be filtered by, in the order a dish goes through them. */
const PICTURE_STATES = ['ready', 'drawing', 'failed', 'none'] as const;

/**
 * Recetas (`0068`): how big the catalogue is, by meal and by where the recipes came
 * from, then every recipe as a table that searches by name, filters, sorts and pages.
 *
 * The catalogue is shared reference data: what a dish is, never who asked for it
 * (`0028`). Its allergens are the dish's label, computed from its ingredients — not
 * anybody's allergy. It reads no period: the catalogue is what it is today.
 */
export default async function AdminRecipesPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const table = readTableQuery(recipeCatalogueQuerySchema, query);
  const [dictionary, locale, recipes, allergens] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminRecipesView>(`/admin/catalogue/recipes?${apiSearch(table)}`),
    serverApi<readonly Allergen[]>('/safety/allergens')
  ]);

  if (!recipes) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminRecipes;
  const { counts } = recipes;
  const number = (value: number) => formatNumber(value, locale);
  const grams = (value: number | null) => (value === null ? '—' : formatNumber(value, locale, { maximumFractionDigits: 1 }));
  const kcal = (value: number | null) => (value === null ? '—' : formatNumber(value, locale, { maximumFractionDigits: 0 }));
  const allergenName = new Map((allergens ?? []).map(allergen => [allergen.key, allergen.labelEs]));
  // The catalogue names allergens in Spanish only (`labelEs`): marked so, for a screen reader on the English page.
  const names = (keys: readonly string[]) =>
    keys.length === 0 ? '—' : <span lang="es">{keys.map(key => allergenName.get(key) ?? key).join(', ')}</span>;
  const slotName = (slot: string) => dictionary.slots[slot as MealSlot] ?? slot;
  const sourceCount = (source: string) => counts.bySource.find(row => row.source === source)?.n ?? 0;

  const columns: AdminTableColumn[] = [
    { header: t.columns.name, key: 'name', sort: { first: 'asc', phrase: t.sortBy.name, value: 'name' } },
    { header: t.columns.meals, key: 'meals' },
    { align: 'end', header: t.columns.kcal, key: 'kcal', sort: { first: 'desc', phrase: t.sortBy.kcal, value: 'kcal' } },
    { align: 'end', header: t.columns.protein, key: 'protein', sort: { first: 'desc', phrase: t.sortBy.protein, value: 'protein' } },
    { align: 'end', header: t.columns.carbs, key: 'carbs' },
    { align: 'end', header: t.columns.fat, key: 'fat' },
    { header: t.columns.allergens, key: 'allergens' },
    { header: t.columns.mayContain, key: 'mayContain' },
    { header: t.columns.picture, key: 'picture' },
    { header: t.columns.source, key: 'source' },
    { header: t.columns.locale, key: 'locale' }
  ];

  const filters: AdminTableFilter[] = [
    {
      anyLabel: common.table.any,
      label: t.check,
      name: 'check',
      options: RECIPE_CHECKS.map(check => ({ label: t.checks[check], value: check })),
      value: table.check
    },
    {
      anyLabel: common.table.any,
      label: t.slot,
      name: 'slot',
      options: MEAL_SLOTS.map(slot => ({ label: dictionary.slots[slot], value: slot })),
      value: table.slot
    },
    {
      anyLabel: common.table.any,
      label: t.containsAllergen,
      name: 'allergen',
      options: (allergens ?? []).map(allergen => ({ label: allergen.labelEs, lang: 'es', value: allergen.key })),
      value: table.allergen
    },
    {
      anyLabel: common.table.any,
      label: t.columns.picture,
      name: 'picture',
      options: PICTURE_STATES.map(state => ({ label: t.pictures[state], value: state })),
      value: table.picture
    },
    {
      anyLabel: common.table.any,
      label: t.columns.source,
      name: 'source',
      options: RECIPE_SOURCES.map(source => ({ label: t.sources[source], value: source })),
      value: table.source
    },
    {
      anyLabel: common.table.any,
      label: t.columns.locale,
      name: 'locale',
      options: LOCALES.map(code => ({ label: t.locales[code], value: code })),
      value: table.locale
    }
  ];

  const madridDate = (iso: string) =>
    formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid', year: 'numeric' });
  const reasons = dictionary.adminPictures.reasons;

  // The state, then why it is not a picture, then what happens next: the button for a
  // picture that can be retried by hand (`0066`), or the wait it is in.
  const pictureCell = (recipe: CatalogueRecipeView): ReactNode => {
    if (recipe.pictureReason === null) {
      return t.pictures[recipe.picture];
    }

    return (
      <div className={styles.picture}>
        <span>{t.pictures[recipe.picture]}</span>
        <span className={styles.reason}>{reasons[recipe.pictureReason]}</span>
        <span className={styles.reason}>
          {recipe.retryableAt === null ? t.retryNext : interpolate(t.retryFrom, { date: madridDate(recipe.retryableAt) })}
        </span>
        <RetryPictureButton dish={recipe.name} recipeId={recipe.id} version={`${recipe.pictureReason}:${recipe.retryableAt}`} />
      </div>
    );
  };

  const rows = recipes.rows.map((recipe: CatalogueRecipeView) => ({
    id: recipe.slug,
    cells: {
      allergens: names(recipe.allergens),
      carbs: grams(recipe.carbsG),
      fat: grams(recipe.fatG),
      kcal: kcal(recipe.kcal),
      locale: t.locales[recipe.locale as keyof typeof t.locales] ?? recipe.locale,
      mayContain: names(recipe.mayContain),
      meals: recipe.mealSlots.map(slotName).join(', '),
      name: recipe.name,
      picture: pictureCell(recipe),
      protein: grams(recipe.proteinG),
      source: t.sources[recipe.source as keyof typeof t.sources] ?? recipe.source
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />
      <p className="visually-hidden" id={RETRY_STATUS_ID} role="status" />

      <ul aria-label={t.tilesLabel} className={styles.tiles}>
        <Card as="li" padding="sm">
          <StatTile label={t.tiles.total} locale={locale} value={number(counts.total)} />
        </Card>
        <Card as="li" padding="sm">
          <StatTile label={t.tiles.withoutImage} locale={locale} value={number(counts.withoutImage)} />
        </Card>
        {RECIPE_SOURCES.map(source => (
          <Card as="li" key={source} padding="sm">
            <StatTile label={t.tiles[source]} locale={locale} value={number(sourceCount(source))} />
          </Card>
        ))}
      </ul>

      <AdminSection title={t.bySlotTitle}>
        <Card>
          <BarChart
            className={styles.chart}
            dataLabel={common.dataLabel}
            emptyLabel={t.bySlotEmpty}
            labels={counts.bySlot.map(row => slotName(row.slot))}
            labelsHeader={t.slot}
            locale={locale}
            series={[{ name: t.bySlotSeries, values: counts.bySlot.map(row => row.n) }]}
            title={t.bySlotChart}
          />
        </Card>
      </AdminSection>

      <AdminSection title={t.tableTitle}>
        <AdminTable
          caption={t.caption}
          columns={columns}
          empty={t.empty}
          filters={filters}
          locale={locale}
          noMatch={t.noMatch}
          paging={{ offset: recipes.offset, size: recipes.size }}
          pathname={PATHNAME}
          query={query}
          rows={rows}
          search={{ label: t.search, value: table.q }}
          sort={{ dir: table.dir, value: table.sort }}
          total={recipes.total}
          words={common.table}
        />
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
