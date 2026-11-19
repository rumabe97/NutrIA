import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';

import { AdminEntryLinks } from 'components/AdminEntryLinks';
import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';

import { professionalQuerySchema } from 'core/entities/AdminQuery';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';
import { practiceState } from './practiceState';

import type { AdminTableColumn } from 'components/AdminTable';
import type { BadgeQueueView, ProfessionalAccountView, ProfileQueueView } from 'core/controllers/Professional';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/profesionales');
}

const PATHNAME = '/admin/profesionales';

/**
 * Profesionales (`0059`, `0068`): every account with a practice, with the number its
 * standing badge checked (a dash without one), since when, and its links counted by
 * status — counts, never a client named (`0028`). Searches by address and sorts;
 * unpaged, because there are few.
 *
 * Since PRD 025 an account opens its own practice, so nothing is granted here. What the
 * owner does is look: two entry rows lead to the profiles waiting for a first look and to
 * the badges waiting for a check (each saying what waits behind it), and each row's
 * address opens the practitioner — its badge, what stands against the practice and the
 * three acts: suspend, close, lift. The row says in a word what stands on it
 * (`practiceState`); an account whose practice was closed stays listed, with no date, so
 * it can be found and lifted. An unchecked number is never drawn: the API sends only the
 * one a standing badge checked.
 */
export default async function AdminProfessionalsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const table = readTableQuery(professionalQuerySchema, query);
  const [dictionary, locale, professionals, queue, badges] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<readonly ProfessionalAccountView[]>(`/admin/professionals?${apiSearch(table)}`),
    serverApi<ProfileQueueView>('/admin/professionals/queue'),
    serverApi<BadgeQueueView>('/admin/professionals/badges')
  ]);

  if (!professionals) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminProfessionals;
  const number = (value: number) => formatNumber(value, locale);
  const day = (iso: string) => formatDate(iso.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' });

  const columns: AdminTableColumn[] = [
    { header: t.columns.email, key: 'email', sort: { first: 'asc', phrase: t.sortBy.email, value: 'email' } },
    { header: t.columns.collegiate, key: 'collegiate' },
    { header: t.columns.granted, key: 'granted', sort: { first: 'desc', phrase: t.sortBy.grantedAt, value: 'grantedAt' } },
    { header: t.columns.links, key: 'links', sort: { first: 'desc', phrase: t.sortBy.links, value: 'links' } },
    { header: t.columns.state, key: 'state' }
  ];

  const rows = professionals.map(professional => ({
    id: professional.userId,
    cells: {
      collegiate: professional.collegiateNumber ?? '—',
      email: (
        <Link className={styles.email} href={`${PATHNAME}/${encodeURIComponent(professional.userId)}`}>
          {professional.email}
        </Link>
      ),
      granted: professional.grantedAt ? day(professional.grantedAt) : '—',
      links: interpolate(t.links, {
        active: number(professional.links.active),
        ended: number(professional.links.ended),
        paused: number(professional.links.paused)
      }),
      state: practiceState(professional)
        .map(word => (word.kind === 'closing' ? interpolate(t.state.closing, { date: day(word.closesAt) }) : t.state[word.kind]))
        .join(' · ')
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />

      <AdminEntryLinks
        label={t.entries.label}
        links={[
          {
            href: '/admin/profesionales/perfiles',
            summary: queue
              ? queue.profiles.length === 0
                ? t.entries.profiles.none
                : interpolate(t.entries.profiles.summary, { count: number(queue.profiles.length) })
              : t.entries.unavailable,
            title: t.entries.profiles.title
          },
          {
            href: '/admin/profesionales/insignias',
            summary: badges
              ? badges.applications.length + badges.due.length === 0
                ? t.entries.badges.none
                : interpolate(t.entries.badges.summary, { applications: number(badges.applications.length), due: number(badges.due.length) })
              : t.entries.unavailable,
            title: t.entries.badges.title
          }
        ]}
      />

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
