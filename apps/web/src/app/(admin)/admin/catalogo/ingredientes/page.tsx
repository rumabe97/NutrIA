import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { HowCounted } from 'components/HowCounted';

import { INGREDIENT_CATEGORIES } from 'core/entities/Plan';
import { ingredientCatalogueQuerySchema } from 'core/entities/AdminQuery';

import { formatNumber } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { AdminIngredientsView } from 'core/controllers/Admin';
import type { AdminTableColumn, AdminTableFilter } from 'components/AdminTable';
import type { Allergen } from 'core/entities/Safety';
import type { IngredientCategory, MealSlot } from 'core/entities/Plan';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/catalogo/ingredientes');
}

const PATHNAME = '/admin/catalogo/ingredientes';

/**
 * Ingredientes (`0068`): every ingredient in the catalogue, per 100 g, with its label —
 * the allergens it contains and may carry as traces, the meals it belongs to and where
 * it is sold — as a table that searches by name, filters, sorts and pages. Shared
 * reference data: nobody's allergy, nobody's food (`0028`).
 */
export default async function AdminIngredientsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const table = readTableQuery(ingredientCatalogueQuerySchema, query);
  const [dictionary, locale, ingredients, allergens] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminIngredientsView>(`/admin/catalogue/ingredients?${apiSearch(table)}`),
    serverApi<readonly Allergen[]>('/safety/allergens')
  ]);

  if (!ingredients) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminIngredients;
  const figure = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 1 });
  const allergenName = new Map((allergens ?? []).map(allergen => [allergen.key, allergen.labelEs]));
  // The catalogue names allergens in Spanish only (`labelEs`): marked so, for a screen reader on the English page.
  const names = (keys: readonly string[]) =>
    keys.length === 0 ? '—' : <span lang="es">{keys.map(key => allergenName.get(key) ?? key).join(', ')}</span>;

  const columns: AdminTableColumn[] = [
    { header: t.columns.name, key: 'name', sort: { first: 'asc', phrase: t.sortBy.name, value: 'name' } },
    { header: t.columns.category, key: 'category', sort: { first: 'asc', phrase: t.sortBy.category, value: 'category' } },
    { align: 'end', header: t.columns.kcal, key: 'kcal', sort: { first: 'desc', phrase: t.sortBy.kcal, value: 'kcal' } },
    { align: 'end', header: t.columns.protein, key: 'protein', sort: { first: 'desc', phrase: t.sortBy.protein, value: 'protein' } },
    { align: 'end', header: t.columns.carbs, key: 'carbs', sort: { first: 'desc', phrase: t.sortBy.carbs, value: 'carbs' } },
    { align: 'end', header: t.columns.fat, key: 'fat', sort: { first: 'desc', phrase: t.sortBy.fat, value: 'fat' } },
    { header: t.columns.allergens, key: 'allergens' },
    { header: t.columns.mayContain, key: 'mayContain' },
    { header: t.columns.meals, key: 'meals' },
    { header: t.columns.countries, key: 'countries' }
  ];

  const filters: AdminTableFilter[] = [
    {
      anyLabel: common.table.any,
      label: t.columns.category,
      name: 'category',
      options: INGREDIENT_CATEGORIES.map(category => ({ label: dictionary.categories[category], value: category })),
      value: table.category
    },
    {
      anyLabel: common.table.any,
      label: t.containsAllergen,
      name: 'allergen',
      options: (allergens ?? []).map(allergen => ({ label: allergen.labelEs, lang: 'es', value: allergen.key })),
      value: table.allergen
    }
  ];

  const rows = ingredients.rows.map(ingredient => ({
    id: ingredient.slug,
    cells: {
      allergens: names(ingredient.allergens),
      carbs: figure(ingredient.carbsPer100g),
      category: dictionary.categories[ingredient.category as IngredientCategory] ?? ingredient.category,
      countries: ingredient.countries.length === 0 ? t.everywhere : ingredient.countries.join(', '),
      fat: figure(ingredient.fatPer100g),
      kcal: formatNumber(ingredient.kcalPer100g, locale, { maximumFractionDigits: 0 }),
      mayContain: names(ingredient.mayContain),
      meals:
        ingredient.mealSlots.length === 0 ? t.everyMeal : ingredient.mealSlots.map(slot => dictionary.slots[slot as MealSlot] ?? slot).join(', '),
      name: ingredient.name,
      protein: figure(ingredient.proteinPer100g)
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />

      <AdminSection title={t.tableTitle}>
        <AdminTable
          caption={t.caption}
          columns={columns}
          empty={t.empty}
          filters={filters}
          locale={locale}
          noMatch={t.noMatch}
          paging={{ offset: ingredients.offset, size: ingredients.size }}
          pathname={PATHNAME}
          query={query}
          rows={rows}
          search={{ label: t.search, value: table.q }}
          sort={{ dir: table.dir, value: table.sort }}
          total={ingredients.total}
          words={common.table}
        />
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
