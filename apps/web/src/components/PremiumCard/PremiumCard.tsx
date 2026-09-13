'use client';
import { useState } from 'react';

import styles from './PremiumCard.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatInstant, formatNumber, interpolate } from 'lib/format';

import type { BillingStatusView } from 'core/controllers/Billing';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';

type Open = Extract<BillingStatusView, { available: true }>;

type Standing = { readonly action: 'checkout' | 'portal' | null; readonly line: string };

/** Where this person stands, in one sentence, and the one thing they can do about it. */
function standingOf(status: Open, justPaid: boolean, t: Dictionary['profile'], locale: Locale): Standing {
  const { subscription, tier } = status;
  const date = subscription?.currentPeriodEnd
    ? formatInstant(Date.parse(subscription.currentPeriodEnd), locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  if (tier === 'premium' && subscription) {
    if (subscription.status === 'past_due') {
      return { action: 'portal', line: t.premiumPastDue };
    }

    return { action: 'portal', line: interpolate(subscription.cancelAtPeriodEnd ? t.premiumEnds : t.premiumRenews, { date }) };
  }

  if (tier === 'premium') {
    return { action: null, line: t.premiumGranted };
  }

  // Back from Stripe before its webhook has arrived: paid, and a moment from showing it.
  return { action: 'checkout', line: justPaid ? t.premiumJustPaid : t.premiumPitch };
}

/**
 * Premium on the profile (`0056`): what it gives, what it costs, and the one
 * button that fits where the person stands — subscribe, or manage the
 * subscription on Stripe's own page. Drawn only when billing is open to them.
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
  const { action, line } = standingOf(status, justPaid, t, locale);
  const price = status.price
    ? interpolate(status.price.interval === 'year' ? t.premiumPerYear : t.premiumPerMonth, {
        price: formatNumber(status.price.amount / 100, locale, { currency: status.price.currency.toUpperCase(), style: 'currency' })
      })
    : null;

  async function go(path: '/billing/checkout' | '/billing/portal') {
    setPending(true);
    setError(undefined);

    try {
      const { url } = await api<{ url: string }>(path, { method: 'POST' });

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
      {action === 'checkout' && price ? (
        <Text size="sm" tone="secondary">
          {price}
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
      {action ? (
        <Button
          disabled={pending}
          onClick={() => void go(action === 'checkout' ? '/billing/checkout' : '/billing/portal')}
          type="button"
          variant={action === 'checkout' ? undefined : 'secondary'}
        >
          {action === 'checkout' ? t.premiumSubscribe : t.premiumManage}
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
