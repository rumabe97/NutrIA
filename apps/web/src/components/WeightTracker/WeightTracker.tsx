'use client';
import { useState } from 'react';

import Link from 'next/link';

import styles from './WeightTracker.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { formatNumber, interpolate } from 'lib/format';

import type { WeightView } from 'core/controllers/Progress';

/** How many readings the sparkline draws. More than this and it is a chart, which is a different screen. */
const SPARK_POINTS = 14;

/**
 * Today's weight, logged from the dashboard.
 *
 * On the home screen rather than behind a "progress" section because the whole
 * value of a weight is logging it *often*, and anything that takes a navigation
 * gets logged weekly at best.
 *
 * Logging does **not** move the goal's starting weight, which is what every
 * nutrition target was computed against. Re-deriving someone's calories because
 * they stepped on a scale would change the number they act on without their
 * asking; targets are corrected on the profile, where it is visible and
 * reversible.
 */
export function WeightTracker({ weight }: { weight: WeightView }) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.dashboard;
  const [view, setView] = useState(weight);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function log() {
    const weightKg = Number(value.replace(',', '.'));

    if (!Number.isFinite(weightKg) || weightKg <= 0) {return;}

    setError(undefined);
    setPending(true);

    try {
      setView(await api<WeightView>('/progress/weight', { body: { weightKg }, method: 'POST' }));
      setValue('');
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  // Oldest to newest, so the line reads left to right like every other chart.
  const points = [...view.entries].reverse().slice(-SPARK_POINTS);
  const values = points.map(point => point.weightKg);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <Text size="sm" tone="tertiary">
          {t.weightTitle}
        </Text>
        {view.latestKg === null ? null : (
          <Text size="sm" tone="tertiary">
            {view.changeKg === null
              ? t.weightStable
              : interpolate(t.weightSince, { change: `${view.changeKg > 0 ? '+' : ''}${formatNumber(view.changeKg, locale)}` })}
          </Text>
        )}
      </div>

      <p className={styles.current}>
        {view.latestKg === null ? (
          <span className={styles.empty}>{t.weightNone}</span>
        ) : (
          <span>
            {formatNumber(view.latestKg, locale)} <span className={styles.unit}>{dictionary.units.kilogram}</span>
          </span>
        )}
      </p>

      {points.length > 1 ? (
        /* A shape, not a chart. Two readings a fortnight apart is a direction,
           and a direction is all this space can honestly carry. */
        <svg aria-hidden="true" className={styles.spark} preserveAspectRatio="none" viewBox="0 0 100 28">
          <polyline
            points={points.map((point, index) => `${(index / (points.length - 1)) * 100},${28 - ((point.weightKg - low) / span) * 24 - 2}`).join(' ')}
          />
        </svg>
      ) : null}

      <div className={styles.form}>
        <Input
          inputMode="decimal"
          label={t.weightToday}
          onChange={event => setValue(event.target.value)}
          placeholder={t.weightPlaceholder}
          value={value}
        />
        <Button disabled={value.trim() === ''} loading={pending} onClick={() => void log()} size="sm" type="button">
          {t.weightLog}
        </Button>
      </div>

      <div className={styles.foot}>
        {view.startingWeightKg === null ? (
          <span />
        ) : (
          <Text size="xs" tone="tertiary">
            {interpolate(t.weightStart, { value: formatNumber(view.startingWeightKg, locale) })}
          </Text>
        )}
        <Link className={styles.more} href="/progreso">
          {t.weightMore}
        </Link>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
