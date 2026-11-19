import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from '../../subpage.module.css';

import { activeLocale, getDictionary } from 'i18n/server';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { BadgeCheck } from 'components/BadgeCheck';
import { BadgeRecord } from 'components/BadgeRecord';
import { Card } from 'components/Card';

import { formatInstant, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { absoluteUrl } from '../../../../../_shared/pages';
import { consoleMetadata } from '../../../consoleMetadata';

import type { BadgeRecordView } from 'core/controllers/Professional';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/profesionales/[userId]/insignia');
}

/** Where the privacy policy answers for the letter and the mail: whole, because a letter has no links. */
const PRIVACY = '/privacidad#tu-profesional';

/**
 * Profesionales › one badge (project 025 phase 9, PRD criteria 3 and 5; sheet
 * «ConsolaDistintivo»): the name and the college the person declared, the number they
 * declared — shown here, to the owner, as declared and never as checked — and the three
 * steps that turn an application into a badge: look at the register, send the code,
 * decide. Under them, every step ever written on the account.
 *
 * The page names the account and its practitioner data only: never a client (`0028`),
 * never a contact a code went to — none is kept. An id that is no account is the
 * console's 404, as is one the API refuses.
 */
export default async function AdminBadgePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [dictionary, locale, record] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<BadgeRecordView>(`/admin/professionals/${encodeURIComponent(userId)}/badge`)
  ]);

  if (!record) {
    notFound();
  }

  const t = dictionary.adminBadge;
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const { application, badge, code } = record;
  const standing = application === null && badge !== null && (record.state === 'badged' || record.state === 'due');

  const intro = (): string => {
    switch (record.state) {
      case 'applied':
        return t.states.applied;
      case 'code_sent':
        return code?.entered ? t.states.codeEntered : interpolate(t.states.codeSent, { date: code ? day(code.expiresAt) : '' });
      case 'badged':
        return interpolate(t.states.badged, { date: badge ? day(badge.dueAt) : '' });
      case 'due':
        return interpolate(t.states.due, { dueDate: badge ? day(badge.dueAt) : '', lapseDate: badge ? day(badge.lapsesAt) : '' });
      default:
        return t.states[record.state];
    }
  };

  const facts: readonly { label: string; value: string }[] = application
    ? [
        { label: t.facts.email, value: record.email },
        { label: t.facts.register, value: application.register ?? '—' },
        { label: t.facts.declaredNumber, value: application.number ?? '—' },
        { label: t.facts.applied, value: day(application.appliedAt) }
      ]
    : standing && badge
      ? [
          { label: t.facts.email, value: record.email },
          { label: t.facts.register, value: badge.register ?? '—' },
          { label: t.facts.checkedNumber, value: badge.number ?? '—' },
          { label: t.facts.checked, value: day(badge.checkedAt) },
          { label: t.facts.due, value: day(badge.dueAt) },
          { label: t.facts.lapses, value: day(badge.lapsesAt) }
        ]
      : [
          { label: t.facts.email, value: record.email },
          { label: dictionary.adminProfessionals.columns.state, value: t.stateWord[record.state] }
        ];

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.link} href="/admin/profesionales/insignias">
          {t.back}
        </Link>
      </p>

      <AdminPageHeader
        intro={intro()}
        title={interpolate(application ? t.title : standing ? t.titleRenewal : t.titleNothing, { name: record.name })}
      />

      <Card as="dl" className={styles.facts}>
        {facts.map(fact => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </Card>

      <div className={styles.columns}>
        <BadgeCheck privacyUrl={absoluteUrl(PRIVACY)} record={record} />
        <BadgeRecord checks={record.checks} dictionary={dictionary} locale={locale} />
      </div>
    </div>
  );
}
