import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from '../subpage.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';

import { PracticeNameForm } from 'components/PracticeNameForm';
import { PracticeProfileForm } from 'components/PracticeProfileForm';

import { formatInstant, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { CarePracticeView } from 'core/controllers/Care';
import type { Metadata } from 'next';
import type { ProfessionalProfileView } from 'core/controllers/Professional';
import type { UserView } from 'core/controllers/User';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/consulta/perfil');
}

/**
 * The practitioner's own profile (PRD 025 scope 4; sheet «EditarPerfil»):
 * where its review stands — «Pendiente de revisión» or «Revisado», never
 * «approved» (`textos/01` § 5) — the owner's statement while it is hidden
 * (`textos/06` § X), the form, and the account's name, which is what a client
 * sees in an invitation and the one place it is changed from a practice.
 *
 * Only for an account with a practice: anyone else gets the 404 `/consulta`
 * gives. Seen by its author and the owner only; nothing here names a client.
 */
export default async function PracticeProfilePage() {
  const [dictionary, locale, practice, profile, user] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<CarePracticeView>('/care/practice'),
    serverApi<ProfessionalProfileView | null>('/care/practice/profile'),
    serverApi<UserView>('/users/me')
  ]);

  if (!practice || !user) {
    notFound();
  }

  const t = dictionary.practice;
  const hidden = profile?.hidden ?? null;
  const review = profile ? (hidden ? t.profileReviewState.hidden : t.profileReviewState[profile.review]) : null;
  const reasons = hidden
    ? [
        ...hidden.reasons.map(reason => interpolate(t.profileHiddenReasons[reason], { word: hidden.word ?? '' })),
        ...(hidden.facts ? [hidden.facts] : [])
      ]
    : [];

  return (
    <Fragment>
      <Link className={styles.back} href="/consulta">
        {t.back}
      </Link>

      <div className={`${styles.head} motion-enter`}>
        <h1 className={styles.title}>{t.profileTitle}</h1>
        {review ? <span className={styles.tag}>{review}</span> : null}
        <Text className={styles.intro} size="sm" tone="secondary">
          {t.profileReviewNote}
        </Text>
      </div>

      <div className={`${styles.regions} motion-list`}>
        {hidden ? (
          <Note as="section" tone="warning" toneLabel={dictionary.common.noteTone.warning}>
            <Text size="sm" weight="medium">
              {t.profileReviewState.hidden}
              {' · '}
              {formatInstant(Date.parse(hidden.at), locale, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            {reasons.length > 0 ? <Text size="sm">{interpolate(t.why, { reason: reasons.join(' ') })}</Text> : null}
            <Text size="sm">{t.profileHiddenRedress}</Text>
          </Note>
        ) : null}

        <PracticeProfileForm profile={profile} />

        <PracticeNameForm name={user.name} />
      </div>
    </Fragment>
  );
}
