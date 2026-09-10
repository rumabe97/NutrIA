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

import { appMetadata } from '../../_shared/metadata';

import type { Locale } from 'i18n/config';
import type { Metadata } from 'next';
import type { ProgressSummaryView } from 'core/controllers/Progress';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/progreso');
}

function kg(value: number, locale: Locale): string {
  return formatNumber(value, locale, { maximumFractionDigits: 1 });
}

function signed(value: number, locale: Locale): string {
  return `${value > 0 ? '+' : ''}${kg(value, locale)}`;
}

/**
 * What the product has kept about how it is going: four figures, the weight
 * line, and every fortnight with its meal marks and check-in. Nothing here is
 * estimated; the page is a reading of what the person logged, so an empty part
 * says so rather than showing a number it does not have.
 */
export default async function ProgressPage() {
  await redirectIfOnboardingIncomplete();

  const [dictionary, locale, summary] = await Promise.all([getDictionary(), activeLocale(), serverApi<ProgressSummaryView>('/progress/summary')]);
  const t = dictionary.progress;
  const unit = dictionary.units.kilogram;

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

  // A change of exactly nothing is "no change", not "0 kg": the second reads as
  // a measurement that came out at zero.
  const change = (value: number | null) =>
    value === null ? { note: null, value: t.noData } : value === 0 ? { note: null, value: t.noChange } : { note: unit, value: signed(value, locale) };
  const toTarget =
    weight.toTargetKg === null
      ? { note: null, value: t.noData }
      : Math.abs(weight.toTargetKg) < 0.05
        ? { note: null, value: t.reached }
        : { note: `${unit} ${weight.toTargetKg < 0 ? t.toLose : t.toGain}`, value: kg(Math.abs(weight.toTargetKg), locale) };
  const tiles = [
    { label: t.weightLatest, note: weight.latestKg === null ? null : unit, value: weight.latestKg === null ? t.noData : kg(weight.latestKg, locale) },
    { label: t.sinceStart, ...change(weight.changeKg) },
    { label: t.lastFortnight, ...change(weight.fortnightChangeKg) },
    { label: t.toTarget, ...toTarget }
  ];

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      <Text className={styles.intro} tone="secondary">
        {t.intro}
      </Text>

      <dl className={styles.tiles}>
        {tiles.map(tile => (
          <div className={styles.tile} key={tile.label}>
            <dt className={styles.tileLabel}>{tile.label}</dt>
            <dd className={styles.tileValue}>
              {tile.value}
              {tile.note ? <span className={styles.tileNote}> {tile.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <section className={styles.card}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.subtitle}>{t.weightTitle}</h2>
            {weight.startingWeightKg === null ? null : (
              <Text size="xs" tone="tertiary">
                {interpolate(t.weightStart, { value: kg(weight.startingWeightKg, locale) })}
              </Text>
            )}
          </div>
          <Link className={styles.link} href="/inicio">
            {t.logLink}
          </Link>
        </div>

        {weight.latestKg === null ? (
          <Text tone="secondary">{t.weightNone}</Text>
        ) : (
          <WeightChart entries={weight.entries} targetKg={weight.targetWeightKg} />
        )}
      </section>

      <section className={styles.fortnights}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.subtitle}>{t.fortnightsTitle}</h2>
            <Text size="xs" tone="tertiary">
              {overall.adherence === null ? t.overallNone : interpolate(t.overallLine, { eaten: overall.eaten, marked: overall.marked })}
            </Text>
          </div>
          <Link className={styles.link} href="/plan/historial">
            {t.allPlans}
          </Link>
        </div>

        {fortnights.length === 0 ? <Text tone="secondary">{t.emptyBody}</Text> : <FortnightList fortnights={fortnights} />}
      </section>
    </Fragment>
  );
}
