import { Fragment } from 'react';

import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';

import { LIVED_PLAN_STATUSES } from 'core/entities/Plan';

import { formatDate, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { Metadata } from 'next';
import type { PlanSummaryView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/plan/historial');
}

/**
 * Every plan the person has lived, newest first, each one a door to the plan
 * as it was (0021). The current plan is listed too, so the list is complete,
 * and it leads to the living screen rather than to a frozen copy of it.
 */
export default async function PlanHistoryPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, locale, plans] = await Promise.all([getDictionary(), activeLocale(), serverApi<readonly PlanSummaryView[]>('/meal-plans')]);
  const t = dictionary.plan;
  const lived = (plans ?? []).filter(plan => LIVED_PLAN_STATUSES.has(plan.status));
  const shortDate = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short' });
  const chip = (plan: PlanSummaryView) => (plan.status === 'active' ? t.historyCurrent : plan.replaced ? t.historyReplaced : t.historyFinished);

  if (lived.length === 0) {
    return (
      <EmptyState body={t.historyEmpty} title={t.historyTitle}>
        <CtaLink href="/plan" size="lg">
          {t.title}
        </CtaLink>
      </EmptyState>
    );
  }

  return (
    <Fragment>
      <h1 className={styles.title}>{t.historyTitle}</h1>
      <Text className={styles.intro} tone="secondary">
        {t.historyIntro}
      </Text>

      <ol className={styles.list}>
        {lived.map(plan => (
          <li key={plan.id}>
            <Link
              className={styles.card}
              data-status={plan.status === 'active' ? 'active' : plan.replaced ? 'replaced' : 'finished'}
              href={plan.status === 'active' ? '/plan' : `/plan/historial/${plan.id}`}
            >
              <span className={styles.range}>{interpolate(t.range, { end: shortDate(plan.endDate), start: shortDate(plan.startDate) })}</span>
              <span className={styles.meta}>
                <span>{interpolate(t.historyPlan, { version: plan.version })}</span>
                <span className={styles.chip}>{chip(plan)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Fragment>
  );
}
