import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { ProfessionalRevoke } from 'components/ProfessionalRevoke';

import { professionalQuerySchema } from 'core/entities/AdminQuery';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AdminTableColumn } from 'components/AdminTable';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';
import type { ProfessionalAccountView } from 'core/controllers/Professional';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/profesionales');
}

const PATHNAME = '/admin/profesionales';

/**
 * Profesionales (`0059`, `0068`): every account granted the practice, with its
 * collegiate number, since when, and its links counted by status — counts, never a
 * client named (`0028`). Searches by address and sorts; unpaged, because there are few.
 * The grant is made on Cuentas; taking it back is here.
 */
export default async function AdminProfessionalsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const table = readTableQuery(professionalQuerySchema, query);
  const [dictionary, locale, professionals] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<readonly ProfessionalAccountView[]>(`/admin/professionals?${apiSearch(table)}`)
  ]);

  if (!professionals) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminProfessionals;
  const number = (value: number) => formatNumber(value, locale);

  const columns: AdminTableColumn[] = [
    { header: t.columns.email, key: 'email', sort: { first: 'asc', phrase: t.sortBy.email, value: 'email' } },
    { header: t.columns.collegiate, key: 'collegiate' },
    { header: t.columns.granted, key: 'granted', sort: { first: 'desc', phrase: t.sortBy.grantedAt, value: 'grantedAt' } },
    { header: t.columns.links, key: 'links', sort: { first: 'desc', phrase: t.sortBy.links, value: 'links' } },
    { header: t.columns.actions, key: 'actions' }
  ];

  const rows = professionals.map(professional => ({
    id: professional.userId,
    cells: {
      actions: <ProfessionalRevoke email={professional.email} userId={professional.userId} />,
      collegiate: professional.collegiateNumber,
      email: <span className={styles.email}>{professional.email}</span>,
      granted: formatDate(professional.grantedAt.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' }),
      links: interpolate(t.links, {
        active: number(professional.links.active),
        ended: number(professional.links.ended),
        paused: number(professional.links.paused)
      })
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />

      <AdminTable
        caption={t.caption}
        columns={columns}
        empty={t.empty}
        locale={locale}
        noMatch={t.noMatch}
        pathname={PATHNAME}
        query={query}
        rows={rows}
        search={{ label: t.search, value: table.q }}
        sort={{ dir: table.dir, value: table.sort }}
        total={professionals.length}
        words={common.table}
      />
    </div>
  );
}
