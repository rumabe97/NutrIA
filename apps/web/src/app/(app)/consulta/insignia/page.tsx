import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from '../subpage.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { BackLabel } from 'components/BackLabel';
import { PracticeBadge } from 'components/PracticeBadge';

import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { BadgeView } from 'core/controllers/Professional';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/consulta/insignia');
}

/**
 * The practitioner's badge (PRD 025 scope 6; sheet «Distintivo»): where it
 * stands and the one thing to do next — apply, enter the code, or nothing.
 * `GET /care/practice/badge` is the practitioner's own and answers 404 to
 * anyone without a practice, as this page does.
 */
export default async function PracticeBadgePage() {
  const [dictionary, badge] = await Promise.all([getDictionary(), serverApi<BadgeView>('/care/practice/badge')]);

  if (!badge) {
    notFound();
  }

  const t = dictionary.practice;

  return (
    <Fragment>
      <Link className={styles.back} href="/consulta">
        <BackLabel text={t.back} />
      </Link>

      <div className={`${styles.head} motion-enter`}>
        <h1 className={styles.title}>{t.badgeTitle}</h1>
        <Text className={styles.intro} size="sm" tone="secondary">
          {t.badgeApplyIntro}
        </Text>
      </div>

      <div className={`${styles.regions} motion-list`}>
        <PracticeBadge badge={badge} />
      </div>
    </Fragment>
  );
}
