import styles from './CareFortnightList.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { formatDate, formatNumber, interpolate } from 'lib/format';

import type { CareFortnightView } from 'core/controllers/Care';

const FULL = 100;

/**
 * Each fortnight a client has lived, newest first, as their professional reads
 * it: adherence by the check-in's own measure, and what the check-in said.
 * Under a hunger answer, the kcal the portion nudge would move the target to
 * (`suggestedKcal`, PRD 004 criterion 10) — a suggestion computed from today's
 * targets, never a change that was made.
 *
 * No link to a plan: those pages are the client's.
 */
export async function CareFortnightList({ fortnights }: Readonly<{ fortnights: readonly CareFortnightView[] }>) {
  const [dictionary, locale] = await Promise.all([getDictionary(), activeLocale()]);
  const t = dictionary.practice;
  const dateOptions = { day: 'numeric', month: 'short' } as const;

  return (
    <ol className={styles.list}>
      {fortnights.map(fortnight => (
        <li className={styles.item} key={fortnight.planId}>
          <div className={styles.head}>
            <h3 className={styles.title}>
              {interpolate(t.fortnightRange, {
                from: formatDate(fortnight.startDate, locale, dateOptions),
                to: formatDate(fortnight.endDate, locale, dateOptions)
              })}
            </h3>
            <span className={styles.percent}>{fortnight.adherence === null ? '—' : `${formatNumber(fortnight.adherence, locale)} %`}</span>
          </div>

          <div aria-hidden="true" className={styles.track}>
            <div className={styles.bar} style={{ inlineSize: `${Math.min(fortnight.adherence ?? 0, FULL)}%` }} />
          </div>
          <Text size="xs" tone="tertiary">
            {fortnight.adherence === null ? t.adherenceNone : t.adherenceLabel}
          </Text>

          {fortnight.checkIn ? (
            <ul className={styles.answers}>
              {fortnight.checkIn.satisfaction === null ? null : (
                <li>{interpolate(t.checkInSatisfaction, { value: fortnight.checkIn.satisfaction })}</li>
              )}
              {fortnight.checkIn.hunger ? <li>{t.checkInHunger[fortnight.checkIn.hunger]}</li> : null}
              {fortnight.checkIn.difficulty ? <li>{t.checkInDifficulty[fortnight.checkIn.difficulty]}</li> : null}
              {fortnight.checkIn.weightKg === null ? null : (
                <li>{interpolate(t.checkInWeight, { value: formatNumber(fortnight.checkIn.weightKg, locale, { maximumFractionDigits: 1 }) })}</li>
              )}
            </ul>
          ) : (
            <Text size="sm" tone="tertiary">
              {t.checkInNone}
            </Text>
          )}

          {fortnight.checkIn?.suggestedKcal ? (
            <p className={styles.suggestion}>{interpolate(t.checkInSuggested, { kcal: formatNumber(fortnight.checkIn.suggestedKcal, locale) })}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
