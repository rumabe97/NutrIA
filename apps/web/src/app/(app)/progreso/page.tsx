import { Fragment } from 'react';

import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { CountUp } from 'ui/components/CountUp';
import { Rings } from 'ui/components/Rings';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
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
      <EmptyState body={t.unavailable} level={1} title={t.title}>
        <CtaLink href="/inicio" size="lg">
          {t.emptyCta}
        </CtaLink>
      </EmptyState>
    );
  }

  const { fortnights, overall, weight } = summary;

  if (fortnights.length === 0 && weight.entries.length === 0) {
    return (
      <EmptyState body={t.emptyBody} level={1} title={t.emptyTitle}>
        <CtaLink href="/inicio" size="lg">
          {t.emptyCta}
        </CtaLink>
      </EmptyState>
    );
  }

  // A change of exactly nothing is "no change", not "0 kg": the second reads as
  // a measurement that came out at zero. A figure that is a number counts up to
  // it when the screen arrives (`CountUp`); a word ("Sin cambios") is just there.
  type Tile = { amount?: number; label: string; note: string | null; signed?: boolean; value: string };
  const change = (label: string, value: number | null): Tile =>
    value === null
      ? { label, note: null, value: t.noData }
      : value === 0
        ? { label, note: null, value: t.noChange }
        : { amount: value, label, note: unit, signed: true, value: signed(value, locale) };
  const toTarget: Tile =
    weight.toTargetKg === null
      ? { label: t.toTarget, note: null, value: t.noData }
      : Math.abs(weight.toTargetKg) < 0.05
        ? { label: t.toTarget, note: null, value: t.reached }
        : {
            amount: Math.abs(weight.toTargetKg),
            label: t.toTarget,
            note: `${unit} ${weight.toTargetKg < 0 ? t.toLose : t.toGain}`,
            value: kg(Math.abs(weight.toTargetKg), locale)
          };
  const tiles: readonly Tile[] = [
    weight.latestKg === null
      ? { label: t.weightLatest, note: null, value: t.noData }
      : { amount: weight.latestKg, label: t.weightLatest, note: unit, value: kg(weight.latestKg, locale) },
    change(t.sinceStart, weight.changeKg),
    change(t.lastFortnight, weight.fortnightChangeKg),
    toTarget
  ];

  return (
    <Fragment>
      <div className={`${styles.intro} motion-enter`}>
        <h1 className={styles.title}>{t.title}</h1>
        <Text className={styles.lede} tone="secondary">
          {t.intro}
        </Text>
      </div>

      <div className={`${styles.board} motion-list`}>
        <Card as="section" className={styles.card}>
          <div className={styles.head}>
            <h2 className={styles.subtitle}>{t.weightTitle}</h2>
            {/* The change since the first reading, at the line's end as the sheet draws it. */}
            {weight.changeKg === null || weight.changeKg === 0 ? null : (
              <span className={styles.delta}>
                <span className="visually-hidden">{t.sinceStart}: </span>
                {signed(weight.changeKg, locale)} {unit}
              </span>
            )}
          </div>

          {weight.latestKg === null ? (
            <Text tone="secondary">{t.weightNone}</Text>
          ) : (
            <WeightChart entries={weight.entries} targetKg={weight.targetWeightKg} />
          )}

          <div className={styles.cardFoot}>
            <Link className={styles.link} href="/inicio#peso">
              {t.logLink}
            </Link>
            {weight.startingWeightKg === null ? null : (
              <Text className={styles.footNote} size="xs" tone="tertiary">
                {interpolate(t.weightStart, { value: kg(weight.startingWeightKg, locale) })}
              </Text>
            )}
          </div>
        </Card>

        {/* The share of marked meals that were done, as a ring beside the sentence that
            says it (the sentence is the text; the ring only its picture). Nothing marked
            yet: the sentence that says how to start, and no empty ring to puzzle over. */}
        <Card className={styles.overall} padding="sm">
          {overall.adherence === null ? null : (
            <Rings
              className={styles.ring}
              decorative={true}
              items={[{ label: t.fortnightsTitle, max: overall.marked, tone: 2, value: overall.eaten }]}
              label={t.fortnightsTitle}
              size="sm"
            />
          )}
          {overall.adherence === null ? (
            <p className={styles.overallNone}>{t.overallNone}</p>
          ) : (
            // One sentence in two sizes: «38 de 42» as the figure, the rest under it.
            <p className={styles.overallLine}>
              <span className={styles.overallFigure}>{interpolate(t.overallFigure, { eaten: overall.eaten, marked: overall.marked })}</span>{' '}
              <span className={styles.overallWords}>{t.overallWords}</span>
            </p>
          )}
        </Card>
      </div>

      <section className={`${styles.fortnights} motion-enter`}>
        <div className={styles.head}>
          <h2 className={styles.subtitle}>{t.fortnightsTitle}</h2>
          <Link className={styles.link} href="/plan/historial">
            {t.allPlans}
          </Link>
        </div>

        {fortnights.length === 0 ? <Text tone="secondary">{t.emptyBody}</Text> : <FortnightList fortnights={fortnights} />}
      </section>

      {/* The four figures, after what the sheet draws: the weight's line and the fortnights
          lead, and the same readings as plain numbers close the screen. */}
      <dl className={`${styles.tiles} motion-list`}>
        {tiles.map(tile => (
          <Card className={styles.tile} key={tile.label} padding="sm">
            <dt className={styles.tileLabel}>{tile.label}</dt>
            <dd className={styles.tileValue}>
              {tile.amount === undefined ? (
                tile.value
              ) : (
                <CountUp
                  format={{ maximumFractionDigits: 1, ...(tile.signed ? { signDisplay: 'exceptZero' } : {}) }}
                  locale={locale}
                  text={tile.value}
                  value={tile.amount}
                />
              )}
              {tile.note ? <span className={styles.tileNote}> {tile.note}</span> : null}
            </dd>
          </Card>
        ))}
      </dl>
    </Fragment>
  );
}
