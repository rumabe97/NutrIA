import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from '../subpage.module.css';

import { activeLocale, getDictionary } from 'i18n/server';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminReflowTable } from 'components/AdminReflowTable';
import { AdminSection } from 'components/AdminSection';

import { formatInstant, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { BadgeQueueView } from 'core/controllers/Professional';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/profesionales/insignias');
}

function badgeHref(userId: string): string {
  return `/admin/profesionales/${encodeURIComponent(userId)}/insignia`;
}

/**
 * Profesionales › insignias por comprobar (project 025 phase 9, PRD criteria 3 and 4;
 * sheet «ConsolaDistintivo», the list that leads to it): the applications waiting for
 * the owner's check, oldest first, and the badges whose yearly re-check is due, the one
 * that lapses first at the top. Each row opens its badge page. The number on an
 * application is the one the person declared, and the column says so; the number on a
 * due badge is the checked one. Never a client (`0028`).
 */
export default async function AdminBadgesPage() {
  const [dictionary, locale, queue] = await Promise.all([getDictionary(), activeLocale(), serverApi<BadgeQueueView>('/admin/professionals/badges')]);

  if (!queue) {
    notFound();
  }

  const t = dictionary.adminBadges;
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const person = (name: string, email: string) => (
    <span className={styles.person}>
      <span>{name}</span>
      <span className={styles.email}>{email}</span>
    </span>
  );
  const applications = [...queue.applications].sort((a, b) => (a.application?.appliedAt ?? '').localeCompare(b.application?.appliedAt ?? ''));
  const link = (userId: string, name: string, label: string) => (
    <Link aria-label={interpolate(t.checkFor, { name })} className={styles.link} href={badgeHref(userId)}>
      {label}
    </Link>
  );

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.link} href="/admin/profesionales">
          {t.back}
        </Link>
      </p>

      <AdminPageHeader intro={t.intro} title={t.title} />

      <AdminSection note={t.applications.note} title={t.applications.title}>
        <AdminReflowTable
          caption={t.applications.caption}
          columns={[
            { header: t.applications.columns.person, key: 'person' },
            { header: t.applications.columns.register, key: 'register' },
            { header: t.applications.columns.number, key: 'number' },
            { header: t.applications.columns.since, key: 'since' },
            { header: t.applications.columns.state, key: 'state' },
            { align: 'end', header: t.applications.columns.action, key: 'actions' }
          ]}
          empty={t.applications.empty}
          rows={applications.map(row => ({
            id: row.userId,
            cells: {
              actions: link(row.userId, row.name, t.check),
              number: row.application?.number ?? '—',
              person: person(row.name, row.email),
              register: row.application?.register ?? '—',
              since: row.application ? day(row.application.appliedAt) : '—',
              state: row.code?.entered
                ? t.applications.states.codeEntered
                : row.code?.live
                  ? t.applications.states.codeSent
                  : t.applications.states.applied
            }
          }))}
        />
      </AdminSection>

      <AdminSection note={t.due.note} title={t.due.title}>
        <AdminReflowTable
          caption={t.due.caption}
          columns={[
            { header: t.due.columns.person, key: 'person' },
            { header: t.due.columns.register, key: 'register' },
            { header: t.due.columns.number, key: 'number' },
            { header: t.due.columns.due, key: 'due' },
            { header: t.due.columns.lapses, key: 'lapses' },
            { align: 'end', header: t.due.columns.action, key: 'actions' }
          ]}
          empty={t.due.empty}
          rows={queue.due.map(row => ({
            id: row.userId,
            cells: {
              actions: link(row.userId, row.name, t.check),
              due: row.badge ? day(row.badge.dueAt) : '—',
              lapses: row.badge ? day(row.badge.lapsesAt) : '—',
              number: row.badge?.number ?? '—',
              person: person(row.name, row.email),
              register: row.badge?.register ?? '—'
            }
          }))}
        />
      </AdminSection>
    </div>
  );
}
