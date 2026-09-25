'use client';
import { useState } from 'react';

import styles from './PracticePlanCard.module.css';

import { Button } from 'ui/components/Button';
import { Link } from 'ui/components/Link';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { Card } from 'components/Card';

import { api, messageFor } from 'lib/api';
import { formatInstant, formatNumber, interpolate } from 'lib/format';

import type { CarePracticeView } from 'core/controllers/Care';
import type { Locale } from 'i18n/config';
import type { PriceView } from 'core/controllers/Billing';

/** The statuses checkout refuses as "already subscribed": the account's one subscription is still being paid. */
const PAYING = new Set(['active', 'past_due', 'trialing']);

/** The one placeholder `practice.planTerms` carries, and the page it opens — the practice's own section of the terms, always rereadable. */
const TERMS_PLACEHOLDER = '{terms}';

interface PracticePlanCardProps {
  /** Back from Stripe's checkout (`?practica=gracias`), possibly before its webhook has opened the practice. */
  justPaid: boolean;
  practice: CarePracticeView;
  /** Whole days of trial left, worked out by the page for the moment it was made; null outside a trial. */
  trialDaysLeft: number | null;
}

function money(price: PriceView, locale: Locale): string {
  return formatNumber(price.amount / 100, locale, { currency: price.currency.toUpperCase(), style: 'currency' });
}

/**
 * The practice's own plan (`0061`): how many of its places are taken, where the
 * subscription stands, and the one thing to do about it — choose a plan while
 * the practice is closed, or manage it on Stripe's portal once there is one.
 * The larger plan is chosen there too, so a full practice is sent to the same
 * button.
 */
export function PracticePlanCard({ justPaid, practice, trialDaysLeft }: PracticePlanCardProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.practice;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { billing } = practice;
  const subscription = billing.available ? billing.subscription : null;
  const paying = subscription !== null && PAYING.has(subscription.status ?? '');
  const date = subscription?.currentPeriodEnd
    ? formatInstant(Date.parse(subscription.currentPeriodEnd), locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function go(path: '/billing/checkout' | '/billing/portal', price?: string) {
    setPending(true);
    setError(undefined);

    try {
      const { url } = await api<{ url: string }>(path, { body: price ? { plan: 'practice', price } : undefined, method: 'POST' });

      // A Stripe page: checkout or the portal. Nothing about the card is ever typed into this site.
      window.location.assign(url);
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  let standing: string;

  if (practice.open) {
    standing =
      subscription?.status === 'past_due'
        ? t.planPastDue
        : trialDaysLeft !== null
          ? interpolate(t.planTrialLeft, { days: formatNumber(trialDaysLeft, locale) })
          : date
            ? interpolate(subscription?.cancelAtPeriodEnd ? t.planEnds : t.planRenews, { date })
            : '';
  } else if (justPaid) {
    standing = t.planJustPaid;
  } else {
    standing = subscription ? t.planLapsed : t.planClosed;
  }

  const choose = billing.available && !practice.open && !paying && !justPaid;

  return (
    <Card aria-labelledby="practice-plan-title" as="section" className={styles.card}>
      <h2 className={styles.title} id="practice-plan-title">
        {t.planTitle}
      </h2>

      {practice.open ? (
        <div className={styles.seats}>
          <Text className={styles.count} weight="semibold">
            {interpolate(t.planSeats, {
              active: formatNumber(practice.activeClients, locale),
              included: formatNumber(practice.includedClients, locale)
            })}
          </Text>
          {practice.pendingInvitations > 0 ? (
            <Text size="sm" tone="secondary">
              {interpolate(t.planSeatsPending, { count: formatNumber(practice.pendingInvitations, locale) })}
            </Text>
          ) : null}
        </div>
      ) : null}

      {billing.available ? (
        standing ? (
          <Text size="sm">{standing}</Text>
        ) : null
      ) : (
        <Text size="sm" tone="secondary">
          {t.planUnavailable}
        </Text>
      )}

      {choose && billing.trialDays ? (
        <Text size="sm" tone="secondary">
          {interpolate(t.planTrial, { days: formatNumber(billing.trialDays, locale) })}
        </Text>
      ) : null}

      {choose ? (
        <div className={styles.actions}>
          {billing.plans.map((plan, index) => (
            <Button
              disabled={pending}
              key={plan.priceId}
              onClick={() => void go('/billing/checkout', plan.priceId)}
              type="button"
              // The smallest plan is where a practice starts; the others are there to compare.
              variant={index === 0 ? 'primary' : 'secondary'}
            >
              {plan.price
                ? interpolate(t.planChoose, { clients: formatNumber(plan.includedClients, locale), price: money(plan.price, locale) })
                : interpolate(t.planChoosePlain, { clients: formatNumber(plan.includedClients, locale) })}
            </Button>
          ))}
        </div>
      ) : null}

      {/* TRLGDCU art. 3: contracting for the practice is professional, not consumer, activity — said plainly next to the button,
          and always here, not only while choosing, so a paying professional can reread what they accepted. */}
      {billing.available ? (
        <Text size="xs" tone="tertiary">
          {t.planTerms.split(/(\{terms\})/).map(part =>
            part === TERMS_PLACEHOLDER ? (
              <Link href={withLocale('/condiciones#dietista', locale)} inline={true} key={part}>
                {t.planTermsLink}
              </Link>
            ) : (
              part
            )
          )}
        </Text>
      ) : null}

      {subscription ? (
        <div className={styles.actions}>
          <Button loading={pending} onClick={() => void go('/billing/portal')} type="button" variant="secondary">
            {t.planManage}
          </Button>
        </div>
      ) : null}

      {billing.available && billing.testMode ? (
        <Text size="xs" tone="tertiary">
          {t.planTestMode}
        </Text>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
