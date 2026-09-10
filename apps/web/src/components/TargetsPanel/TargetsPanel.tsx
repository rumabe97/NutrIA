'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './TargetsPanel.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { MacroSummary } from 'components/MacroSummary';

import { api, ApiError, messageFor } from 'lib/api';
import { formatNumber, interpolate } from 'lib/format';

import type { ResolvedTargets } from 'core/domain/Nutrition';

/** Activity factor → the key its label lives under. The factors are the domain's, not the dictionary's. */
const ACTIVITY_BY_FACTOR: Record<string, 'athlete' | 'high' | 'light' | 'moderate' | 'sedentary'> = {
  1.2: 'sedentary',
  1.375: 'light',
  1.55: 'moderate',
  1.725: 'high',
  1.9: 'athlete'
};

type Draft = { carbsG: string; fatG: string; kcal: string; proteinG: string };

/**
 * The daily targets, said out loud as an estimate.
 *
 * Three things this shows that a bare number does not: that the figure is
 * derived rather than measured, what it was derived from, and whose it is. The
 * 4,099 kcal defect sat on the review screen through a full onboarding pass
 * without looking wrong, because a number in a box reads as a fact. Next to
 * "2,999 kcal de mantenimiento, menos 1 kg/semana" it would have read as a
 * mistake straight away.
 */
export function TargetsPanel({ targets }: { targets: ResolvedTargets }) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.targets;
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [draft, setDraft] = useState<Draft>(() => toDraft(targets));

  const { bounds, derivation, effective, overrideStatus } = targets;

  async function save(body: Record<string, number | null>) {
    setErrors([]);
    setPending(true);

    try {
      await api('/profile/targets', { body, method: 'PATCH' });
      setEditing(false);
      router.refresh();
    } catch (caught) {
      // The API names the bound that was crossed, one sentence per bound. That
      // is the whole value of the refusal, so it is shown verbatim rather than
      // collapsed into "revisa los datos".
      const named = caught instanceof ApiError ? caught.fieldErrors.targets : undefined;

      setErrors(named && named.length > 0 ? named : [messageFor(caught, dictionary)]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <Text size="sm" tone="tertiary">
            {overrideStatus === 'applied' ? t.subtitleOwn : t.subtitleEstimated}
          </Text>
        </div>
        <span className={styles.badge} data-own={overrideStatus === 'applied'}>
          {overrideStatus === 'applied' ? t.badgeYours : t.badgeEstimate}
        </span>
      </div>

      <MacroSummary carbsG={effective.carbsG} fatG={effective.fatG} kcal={effective.kcal} proteinG={effective.proteinG} />

      <Text className={styles.disclaimer} size="sm" tone="secondary">
        {t.disclaimer}
      </Text>

      <details className={styles.details}>
        <summary className={styles.summary}>{t.explain}</summary>
        <dl className={styles.derivation}>
          {[
            { label: t.equation, value: t.equationMifflin },
            { label: t.basalRate, value: interpolate(t.kcalValue, { value: formatNumber(derivation.basalMetabolicRateKcal, locale) }) },
            {
              label: t.activity,
              value: interpolate(t.activityValue, {
                factor: derivation.activityFactor,
                label: dictionary.activity[ACTIVITY_BY_FACTOR[String(derivation.activityFactor)] ?? 'moderate']
              })
            },
            { label: t.maintenance, value: interpolate(t.kcalValue, { value: formatNumber(derivation.maintenanceKcal, locale) }) },
            { label: t.goal, value: dictionary.goals[derivation.goal] ?? derivation.goal },
            { label: t.pace, value: interpolate(dictionary.units.perWeek, { value: formatNumber(derivation.paceKgPerWeek, locale) }) },
            { label: t.computed, value: interpolate(t.kcalValue, { value: formatNumber(derivation.requestedKcal, locale) }) },
            {
              label: t.allowedRange,
              value: interpolate(t.rangeValue, {
                ceiling: formatNumber(derivation.ceilingKcal, locale),
                floor: formatNumber(derivation.floorKcal, locale)
              })
            }
          ].map(row => (
            <div className={styles.row} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </details>

      {derivation.clampedBy ? (
        <p className={styles.notice}>
          {derivation.clampedBy === 'floor'
            ? interpolate(t.clampedFloor, {
                floor: formatNumber(derivation.floorKcal, locale),
                requested: formatNumber(derivation.requestedKcal, locale)
              })
            : interpolate(t.clampedCeiling, {
                ceiling: formatNumber(derivation.ceilingKcal, locale),
                requested: formatNumber(derivation.requestedKcal, locale)
              })}
        </p>
      ) : null}

      {overrideStatus === 'stale' ? <p className={styles.notice}>{t.stale}</p> : null}

      {errors.length > 0 ? (
        <div className={styles.errors} role="alert">
          {errors.map(error => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {editing ? (
        <form
          className={styles.form}
          onSubmit={event => {
            event.preventDefault();
            void save({ carbsG: toNumber(draft.carbsG), fatG: toNumber(draft.fatG), kcal: toNumber(draft.kcal), proteinG: toNumber(draft.proteinG) });
          }}
        >
          <Input
            hint={interpolate(t.hintRange, {
              max: formatNumber(Math.floor(bounds.ceilingKcal), locale),
              min: formatNumber(Math.ceil(bounds.floorKcal), locale)
            })}
            inputMode="numeric"
            label={t.labelKcal}
            onChange={event => setDraft({ ...draft, kcal: event.target.value })}
            value={draft.kcal}
          />
          <Input
            hint={interpolate(t.hintUpTo, { max: formatNumber(Math.floor(bounds.proteinCeilingG), locale) })}
            inputMode="numeric"
            label={t.labelProtein}
            onChange={event => setDraft({ ...draft, proteinG: event.target.value })}
            value={draft.proteinG}
          />
          <Input
            inputMode="numeric"
            label={t.labelCarbs}
            onChange={event => setDraft({ ...draft, carbsG: event.target.value })}
            value={draft.carbsG}
          />
          <Input inputMode="numeric" label={t.labelFat} onChange={event => setDraft({ ...draft, fatG: event.target.value })} value={draft.fatG} />

          <div className={styles.actions}>
            <Button loading={pending} type="submit">
              {pending ? dictionary.common.saving : t.saveTargets}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setDraft(toDraft(targets));
                setErrors([]);
                setEditing(false);
              }}
              type="button"
              variant="secondary"
            >
              {dictionary.common.cancel}
            </Button>
            {overrideStatus === 'none' ? null : (
              <Button
                disabled={pending}
                onClick={() => void save({ carbsG: null, fatG: null, kcal: null, proteinG: null })}
                type="button"
                variant="secondary"
              >
                {t.reset}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className={styles.actions}>
          <Button onClick={() => setEditing(true)} type="button" variant="secondary">
            {t.edit}
          </Button>
        </div>
      )}
    </section>
  );
}

function toDraft({ effective }: ResolvedTargets): Draft {
  return { carbsG: String(effective.carbsG), fatG: String(effective.fatG), kcal: String(effective.kcal), proteinG: String(effective.proteinG) };
}

/** An emptied field means "go back to the computed value", which the API reads as null. */
function toNumber(value: string): number | null {
  const trimmed = value.trim();

  return trimmed === '' ? null : Number(trimmed);
}
