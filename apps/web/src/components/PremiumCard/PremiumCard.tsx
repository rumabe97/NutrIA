'use client';
import { useState } from 'react';

import styles from './PremiumCard.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatInstant, formatNumber, interpolate } from 'lib/format';

import type { BillingStatusView, PriceView } from 'core/controllers/Billing';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';

type Open = Extract<BillingStatusView, { available: true }>;

type Standing = { readonly checkout: boolean; readonly line: string; readonly portal: boolean };

/** Where this person stands, in one sentence, and whether they are buying or managing. */
function standingOf(status: Open, justPaid: boolean, t: Dictionary['profile'], locale: Locale): Standing {
  const { subscription, tier } = status;
  const date = subscription?.currentPeriodEnd
    ? formatInstant(Date.parse(subscription.currentPeriodEnd), locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  if (tier === 'premium' && subscription) {
    const line =
      subscription.status === 'past_due'
        ? t.premiumPastDue
        : subscription.cancelAtPeriodEnd
          ? interpolate(t.premiumEnds, { date })
          : interpolate(subscription.status === 'trialing' ? t.premiumTrialing : t.premiumRenews, { date });

    return { checkout: false, line, portal: true };
  }

  if (tier === 'premium') {
    return { checkout: false, line: t.premiumGranted, portal: false };
  }

  // Back from Stripe before its webhook has arrived: paid, and a moment from showing it.
  return { checkout: true, line: justPaid ? t.premiumJustPaid : t.premiumPitch, portal: false };
}

function money(price: PriceView, locale: Locale): string {
  return formatNumber(price.amount / 100, locale, { currency: price.currency.toUpperCase(), style: 'currency' });
}

/** What a year saves against twelve months, in whole percent; nothing when it saves nothing. */
function saving(monthly: PriceView | null, yearly: PriceView): number | null {
  const percent = monthly ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;

  return percent > 0 ? percent : null;
}

/**
 * Premium on the profile (`0056`): what it gives, what it costs, and the
 * buttons that fit where the person stands — a price to choose, or the
 * subscription to manage on Stripe's own page. Drawn only when billing is open
 * to them.
 *
 * It says what is not for sale as well (`0042`). The first thing someone
 * paying for a health product should not have to wonder is whether the free
 * plan was the unsafe one.
 */
export function PremiumCard({ justPaid, status }: Readonly<{ justPaid: boolean; status: Open }>) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.profile;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { checkout, line, portal } = standingOf(status, justPaid, t, locale);
  const { monthly, yearly } = status.prices;
  const yearlySaving = yearly ? saving(monthly, yearly) : null;

  async function go(path: '/billing/checkout' | '/billing/portal', plan?: 'monthly' | 'yearly') {
    setPending(true);
    setError(undefined);

    try {
      const { url } = await api<{ url: string }>(path, { body: plan ? { plan } : undefined, method: 'POST' });

      // A Stripe page: checkout or the portal. Nothing about the card is ever typed into this site.
      window.location.assign(url);
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <Text size="sm">{line}</Text>
      {checkout && status.trialDays ? (
        <Text size="sm" tone="secondary">
          {interpolate(t.premiumTrial, { days: formatNumber(status.trialDays, locale) })}
        </Text>
      ) : null}
      {checkout ? (
        <div className={styles.plans}>
          {monthly ? (
            <Button disabled={pending} onClick={() => void go('/billing/checkout', 'monthly')} type="button">
              {interpolate(t.premiumMonthly, { price: money(monthly, locale) })}
            </Button>
          ) : null}
          {yearly ? (
            <Button disabled={pending} onClick={() => void go('/billing/checkout', 'yearly')} type="button" variant="secondary">
              {yearlySaving
                ? interpolate(t.premiumYearly, { price: money(yearly, locale), saving: formatNumber(yearlySaving, locale) })
                : interpolate(t.premiumYearlyPlain, { price: money(yearly, locale) })}
            </Button>
          ) : null}
        </div>
      ) : null}
      {checkout ? (
        <Text size="xs" tone="tertiary">
          {t.premiumCancelAnytime}
        </Text>
      ) : null}
      <Text size="xs" tone="tertiary">
        {t.premiumSafety}
      </Text>
      {status.testMode ? (
        <Text size="xs" tone="tertiary">
          {t.premiumTestMode}
        </Text>
      ) : null}
      {portal ? (
        <Button disabled={pending} onClick={() => void go('/billing/portal')} type="button" variant="secondary">
          {t.premiumManage}
        </Button>
      ) : null}
      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
