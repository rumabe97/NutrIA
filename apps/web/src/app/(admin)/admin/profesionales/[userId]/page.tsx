import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from '../subpage.module.css';

import { activeLocale, getDictionary } from 'i18n/server';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { PracticeActs } from 'components/PracticeActs';
import { RestrictionStanding } from 'components/RestrictionStanding';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { linkCounts } from 'lib/linkCounts';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';
import { practiceState } from '../practiceState';

import type { BadgeRecordView, ProfessionalAccountView } from 'core/controllers/Professional';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/profesionales/[userId]');
}

/**
 * Profesionales › one practitioner (project 025 phase 9, PRD criteria 24 and 5): who
 * they are to the console — the address, since when they practise, their links counted
 * and the number their badge checked, never one that was only declared — what stands
 * against the practice and what it was decided for, and the owner's three acts: suspend,
 * close with 30 days' notice, lift. A closed account (`practising: false`) is found
 * here too, so it can be lifted.
 *
 * The API has no read of one practitioner: the page takes the account's row from the
 * owner's list (it is unpaged: there are few) and its badge record for the name, and
 * an id that is in neither is the console's 404. Never a client (`0028`).
 */
export default async function AdminPractitionerPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [dictionary, locale, professionals, record] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<readonly ProfessionalAccountView[]>('/admin/professionals'),
    serverApi<BadgeRecordView>(`/admin/professionals/${encodeURIComponent(userId)}/badge`)
  ]);
  const professional = professionals?.find(row => row.userId === userId);

  if (!professional || !record) {
    notFound();
  }

  const t = dictionary.adminPractice;
  const number = (value: number) => formatNumber(value, locale);
  const day = (iso: string) => formatDate(iso.slice(0, 10), locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const state = practiceState(professional)
    .map(word =>
      'closesAt' in word
        ? interpolate(dictionary.adminProfessionals.state[word.kind], { date: day(word.closesAt) })
        : dictionary.adminProfessionals.state[word.kind]
    )
    .join(' · ');

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.link} href="/admin/profesionales">
          {t.back}
        </Link>
      </p>

      <AdminPageHeader intro={professional.email} title={interpolate(t.title, { name: record.name })} />

      <div className={styles.columns}>
        <div className={styles.stack}>
          <Card as="dl" className={styles.facts}>
            <div>
              <dt>{t.facts.email}</dt>
              <dd>{professional.email}</dd>
            </div>
            <div>
              <dt>{t.facts.state}</dt>
              <dd>{state}</dd>
            </div>
            {professional.grantedAt ? (
              <div>
                <dt>{t.facts.opened}</dt>
                <dd>{day(professional.grantedAt)}</dd>
              </div>
            ) : null}
            <div>
              <dt>{t.facts.links}</dt>
              <dd>{linkCounts(professional.links, dictionary.adminProfessionals, number)}</dd>
            </div>
            {professional.collegiateNumber ? (
              <div>
                <dt>{t.facts.collegiate}</dt>
                <dd>{professional.collegiateNumber}</dd>
              </div>
            ) : null}
            <div>
              <dt>{t.facts.badge}</dt>
              <dd>
                <span>{dictionary.adminBadge.stateWord[record.state]}</span>{' '}
                <Link className={styles.link} href={`/admin/profesionales/${encodeURIComponent(userId)}/insignia`}>
                  {t.facts.badgeLink}
                </Link>
              </dd>
            </div>
          </Card>

          <AdminSection title={t.standing.title}>
            <RestrictionStanding
              dictionary={dictionary}
              locale={locale}
              practising={professional.practising}
              restriction={professional.restriction}
            />
          </AdminSection>
        </div>

        <PracticeActs email={professional.email} practising={professional.practising} restriction={professional.restriction} userId={userId} />
      </div>
    </div>
  );
}
