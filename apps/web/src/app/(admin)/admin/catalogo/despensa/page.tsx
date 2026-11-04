import { Fragment } from 'react';

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { DataTable } from 'ui/components/DataTable';
import { Text } from 'ui/components/Text';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';

import { cupboardGapQuerySchema } from 'core/entities/AdminQuery';

import { UNRESOLVED_THRESHOLD } from 'core/controllers/Admin';

import { formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { AdminCupboardUncookedView, AdminCupboardUnresolvedView } from 'core/controllers/Admin';
import type { AdminTableColumn } from 'components/AdminTable';
import type { IngredientCategory } from 'core/entities/Plan';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/catalogo/despensa');
}

const PATHNAME = '/admin/catalogo/despensa';

/** The most words the first group draws. Two accounts or more is already rare; a hundred of them is the whole list. */
const WORDS_SHOWN = 100;

/**
 * Despensa (project 022, phase 5): what the catalogue could not cook for the cupboards people hold, as two lists
 * because the answer differs — a word with no food behind it (add a food) and a food no recipe uses (write dishes).
 *
 * Counts of accounts and never which: a word is drawn only where two accounts or more hold it, and that floor is in the
 * API's query, so nothing here can lower it and nothing here offers to (`0028`, `legal` P2-6). Both lists are a
 * snapshot of what is held now, never a history.
 */
export default async function AdminCupboardPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const table = readTableQuery(cupboardGapQuerySchema, query);
  const [dictionary, locale, unresolved, uncooked] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminCupboardUnresolvedView>(`/admin/catalogue/cupboard/unresolved?${apiSearch({ offset: 0, size: WORDS_SHOWN })}`),
    serverApi<AdminCupboardUncookedView>(`/admin/catalogue/cupboard/uncooked?${apiSearch(table)}`)
  ]);

  if (!unresolved || !uncooked) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminCupboard;
  const number = (value: number) => formatNumber(value, locale);
  const threshold = number(UNRESOLVED_THRESHOLD);

  const wordColumns = [
    { header: t.unresolved.columns.word, key: 'word' },
    { align: 'end' as const, header: t.unresolved.columns.accounts, key: 'accounts' }
  ];

  const ingredientColumns: AdminTableColumn[] = [
    { header: t.uncooked.columns.name, key: 'name' },
    { header: t.uncooked.columns.category, key: 'category' },
    { align: 'end', header: t.uncooked.columns.accounts, key: 'accounts' }
  ];

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />

      <AdminSection note={`${t.unresolved.answer} ${interpolate(t.unresolved.threshold, { count: threshold })}`} title={t.unresolved.title}>
        {unresolved.total === 0 ? (
          <Card className={styles.empty}>
            <h3 className={styles.emptyTitle}>{t.unresolved.emptyTitle}</h3>
            <Text className={styles.emptyBody} tone="secondary">
              {t.unresolved.emptyBody}
            </Text>
          </Card>
        ) : (
          <Fragment>
            <Text size="sm" tone="secondary">
              {unresolved.total > unresolved.rows.length
                ? interpolate(t.unresolved.firstOnly, { shown: number(unresolved.rows.length), total: number(unresolved.total) })
                : interpolate(common.table.count, { count: number(unresolved.total) })}
            </Text>
            <Card className={styles.card}>
              <DataTable
                caption={t.unresolved.caption}
                columns={wordColumns}
                empty={t.unresolved.emptyTitle}
                hideCaption={true}
                rows={unresolved.rows.map(row => ({ id: row.word, cells: { accounts: number(row.accounts), word: row.word } }))}
              />
            </Card>
          </Fragment>
        )}
      </AdminSection>

      <AdminSection note={t.uncooked.answer} title={t.uncooked.title}>
        <AdminTable
          caption={t.uncooked.caption}
          columns={ingredientColumns}
          empty={t.uncooked.empty}
          locale={locale}
          noMatch={t.uncooked.empty}
          paging={{ offset: uncooked.offset, size: uncooked.size }}
          pathname={PATHNAME}
          query={query}
          rows={uncooked.rows.map(row => ({
            id: row.slug,
            cells: {
              // **A zero here is not «ninguna».** The API floors a count below
              // `UNRESOLVED_THRESHOLD` to 0 — in the `select` and in the `order by`, so the
              // distinction does not come back by position — because a food one account holds,
              // read beside a food twelve hold, is a path to one person on a cohort this size
              // (`legal` P2-10). The column says what the figure means and the cell never claims
              // nobody holds it.
              accounts: row.accounts === 0 ? t.uncooked.belowFloor : number(row.accounts),
              category: dictionary.categories[row.category as IngredientCategory] ?? row.category,
              name: row.name
            }
          }))}
          total={uncooked.total}
          words={common.table}
        />
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
