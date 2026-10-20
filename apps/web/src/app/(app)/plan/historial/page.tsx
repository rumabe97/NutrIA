import { Fragment } from 'react';

import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { PremiumChip } from 'components/PremiumChip';

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
 *
 * **A fortnight a free account does not open is still listed** (`0021`
 * § *Amended*): same dates, same number, marked premium, and not a link. The
 * row is kept rather than dropped on purpose — a shorter list cannot say why it
 * is shorter, and somebody whose past had simply vanished would have no way to
 * tell a paywall from a deletion. The plan being lived is never marked.
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

  const anyLocked = lived.some(plan => plan.locked);
  const dates = (plan: PlanSummaryView) => (
    <span className={styles.range}>{interpolate(t.range, { end: shortDate(plan.endDate), start: shortDate(plan.startDate) })}</span>
  );
  const status = (plan: PlanSummaryView) => (plan.status === 'active' ? 'active' : plan.replaced ? 'replaced' : 'finished');

  return (
    <Fragment>
      <h1 className={styles.title}>{t.historyTitle}</h1>
      <Text className={styles.intro} tone="secondary">
        {anyLocked ? t.historyLockedIntro : t.historyIntro}
      </Text>

      <ol className={styles.list}>
        {lived.map(plan =>
          plan.locked ? (
            <li key={plan.id}>
              {/* Not a link and not a button: there is nothing to press. */}
              <Card as="div" className={styles.card} data-locked="true" data-status={status(plan)}>
                {dates(plan)}
                <span className={styles.meta}>
                  <span>{interpolate(t.historyPlan, { version: plan.version })}</span>
                  <PremiumChip label={t.historyLockedChip} />
                </span>
              </Card>
            </li>
          ) : (
            <li key={plan.id}>
              <Card
                as={Link}
                className={styles.card}
                data-status={status(plan)}
                href={plan.status === 'active' ? '/plan' : `/plan/historial/${plan.id}`}
              >
                {dates(plan)}
                <span className={styles.meta}>
                  <span>{interpolate(t.historyPlan, { version: plan.version })}</span>
                  <span className={styles.chip}>{chip(plan)}</span>
                </span>
              </Card>
            </li>
          )
        )}
      </ol>

      {anyLocked ? (
        <div className={styles.upsell}>
          <CtaLink href="/perfil" size="md" variant="secondary">
            {t.historyLockedCta}
          </CtaLink>
        </div>
      ) : null}
    </Fragment>
  );
}
