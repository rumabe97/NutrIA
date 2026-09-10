import { Fragment } from 'react';

import { redirect } from 'next/navigation';

import styles from './page.module.css';

import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CheckInForm } from 'components/CheckInForm';
import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';

import { interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { CheckInStatusView } from 'core/controllers/CheckIn';
import type { Metadata } from 'next';
import type { WeightView } from 'core/controllers/Progress';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/check-in');
}

export default async function CheckInPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, status, weight] = await Promise.all([
    getDictionary(),
    serverApi<CheckInStatusView>('/check-ins/status'),
    serverApi<WeightView>('/progress/weight')
  ]);
  const t = dictionary.checkIn;

  if (!status?.plan) {
    redirect('/inicio');
  }

  if (status.done) {
    return (
      <EmptyState body={t.alreadyBody} title={t.alreadyTitle}>
        <CtaLink href="/inicio" size="lg">
          {t.backHome}
        </CtaLink>
      </EmptyState>
    );
  }

  if (!status.due) {
    return (
      <EmptyState body={t.notYetBody} title={t.notYetTitle}>
        <CtaLink href="/inicio" size="lg">
          {t.backHome}
        </CtaLink>
      </EmptyState>
    );
  }

  const marked = status.stats.completed + status.stats.skipped;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      <Text className={styles.intro} tone="secondary">
        {t.intro}
      </Text>
      <Text className={styles.adherence} size="sm" tone="tertiary">
        {status.adherence === null
          ? t.adherenceNone
          : interpolate(t.adherence, { completed: status.stats.completed, marked, percent: status.adherence })}
      </Text>

      <CheckInForm latestKg={weight?.latestKg ?? null} planEnded={status.plan.endDate < today} planId={status.plan.id} />
    </Fragment>
  );
}
