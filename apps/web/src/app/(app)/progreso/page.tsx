import { Fragment } from 'react';

import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { EmptyState } from 'components/EmptyState';
import { FortnightList } from 'components/FortnightList';
import { WeightChart } from 'components/WeightChart';

import { formatNumber, interpolate } from 'lib/format';
import { redirectIfOnboardingIncomplete } from 'lib/onboarding';
import { serverApi } from 'lib/server-api';

import type { ProgressSummaryView } from 'core/controllers/Progress';

export const dynamic = 'force-dynamic';

function signed(value: number, locale: Parameters<typeof formatNumber>[1]): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value, locale, { maximumFractionDigits: 1 })}`;
}

/**
 * What the product has kept about how it is going: the weight line, and every
 * fortnight with its meal marks and check-in. Nothing here is estimated; the
 * page is a reading of what the person logged, so an empty part says so
 * rather than showing a number it does not have.
 */
export default async function ProgressPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, locale, summary] = await Promise.all([getDictionary(), activeLocale(), serverApi<ProgressSummaryView>('/progress/summary')]);
  const t = dictionary.progress;

  if (!summary) {
    return (
      <EmptyState body={t.unavailable} title={t.title}>
        <CtaLink href="/inicio" size="lg">
          {t.emptyCta}
        </CtaLink>
      </EmptyState>
    );
  }

  const { fortnights, overall, weight } = summary;

  if (fortnights.length === 0 && weight.entries.length === 0) {
    return (
      <EmptyState body={t.emptyBody} title={t.emptyTitle}>
        <CtaLink href="/inicio" size="lg">
          {t.emptyCta}
        </CtaLink>
      </EmptyState>
    );
  }

  const toTarget =
    weight.toTargetKg === null
      ? null
      : Math.abs(weight.toTargetKg) < 0.05
        ? t.toTargetReached
        : interpolate(weight.toTargetKg < 0 ? t.toTargetLoss : t.toTargetGain, { value: formatNumber(Math.abs(weight.toTargetKg), locale, { maximumFractionDigits: 1 }) });

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      <Text className={styles.intro} tone="secondary">
        {t.intro}
      </Text>

      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.head}>
            <Text size="sm" tone="tertiary">
              {t.weightTitle}
            </Text>
            <Link className={styles.link} href="/inicio">
              {t.logLink}
            </Link>
          </div>

          {weight.latestKg === null ? (
            <Text tone="secondary">{t.weightNone}</Text>
          ) : (
            <Fragment>
              <p className={styles.current}>
                {formatNumber(weight.latestKg, locale, { maximumFractionDigits: 1 })} <span className={styles.unit}>{dictionary.units.kilogram}</span>
              </p>
              <ul className={styles.facts}>
                {weight.changeKg === null ? null : <li>{interpolate(t.weightChangeSinceStart, { change: signed(weight.changeKg, locale) })}</li>}
                {weight.fortnightChangeKg === null ? null : <li>{interpolate(t.weightChangeFortnight, { change: signed(weight.fortnightChangeKg, locale) })}</li>}
                {weight.startingWeightKg === null ? null : <li>{interpolate(t.weightStart, { value: formatNumber(weight.startingWeightKg, locale, { maximumFractionDigits: 1 }) })}</li>}
                {toTarget === null ? null : <li>{toTarget}</li>}
              </ul>
            </Fragment>
          )}

          <WeightChart entries={weight.entries} targetKg={weight.targetWeightKg} />
        </section>

        <section className={styles.fortnights}>
          <div className={styles.head}>
            <h2 className={styles.subtitle}>{t.fortnightsTitle}</h2>
            <Text size="sm" tone="tertiary">
              {overall.adherence === null ? null : interpolate(t.overallLine, { eaten: overall.eaten, marked: overall.marked })}
            </Text>
          </div>

          {fortnights.length === 0 ? (
            <Text tone="secondary">{t.emptyBody}</Text>
          ) : (
            <Fragment>
              {overall.adherence === null ? (
                <Text className={styles.hint} size="sm" tone="tertiary">
                  {t.overallNone}
                </Text>
              ) : null}
              <FortnightList fortnights={fortnights} />
            </Fragment>
          )}
        </section>
      </div>
    </Fragment>
  );
}
