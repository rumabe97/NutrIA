'use client';
import { Fragment, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import styles from './OnboardingFlow.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { ChipGroup } from 'components/ChipGroup';
import { MealShapePicker } from 'components/MealShapePicker';
import { OptionCards } from 'components/OptionCards';
import { SummaryRow } from 'components/SummaryRow';

import { PACE_KG_PER_WEEK } from 'core/entities/Profile';

import { api, ApiError, messageFor } from 'lib/api';
import { formatNumber, interpolate } from 'lib/format';

import { FLOW, TOTAL_STEPS } from './steps';

import type { Allergen } from 'core/entities/Safety';
import type { FormEvent } from 'react';
import type { FullProfileView } from 'core/controllers/Profile';

interface OnboardingFlowProps {
  allergens: readonly Allergen[];
  profile: FullProfileView | null;
  /**
   * Where to go after saving this one step, when the person came to edit it
   * from their profile. The flow then saves and returns rather than marching
   * on to the next step — editing a goal is not redoing the onboarding.
   */
  returnTo?: string | null;
  step: number;
}

/**
 * Option **values**, in the order they are offered. Labels and hints come from
 * the dictionary; these arrays carry only what the API accepts.
 */
const GOAL_VALUES = ['weight_loss', 'maintenance', 'muscle_gain', 'performance', 'healthy_eating', 'custom'] as const;
const ACTIVITY_VALUES = ['sedentary', 'light', 'moderate', 'high', 'athlete'] as const;
const COUNTRY_VALUES = ['ES', 'GB'] as const;
const MEAL_SLOT_VALUES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'] as const;

/** What somebody sees before they answer: the ordinary three, plus something in the afternoon. */
const DEFAULT_SHAPE = { afternoon_snack: 'normal', breakfast: 'normal', dinner: 'normal', lunch: 'normal', morning_snack: 'off', supper: 'off' } as const;
const SEX_VALUES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
const COOKING_FREQUENCY_VALUES = ['rarely', 'sometimes', 'often', 'daily'] as const;
const BUDGET_VALUES = ['low', 'medium', 'high'] as const;
const DIETARY_PATTERN_VALUES = [
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
  'flexitarian',
  'gluten_free',
  'lactose_free',
  'halal',
  'kosher'
] as const;

/**
 * Cuisine names are stored as the string the user picked and are matched against
 * recipe metadata, so they are **not** translated: "Mediterránea" is a value in
 * the database, not a label. Localising the catalogue is phase 6's work.
 */
const CUISINES = ['Mediterránea', 'Española', 'Italiana', 'Mexicana', 'Japonesa', 'India', 'Griega', 'Árabe', 'Tailandesa', 'Peruana'].map(name => ({
  label: name,
  value: name
}));

/**
 * One step per screen, one PATCH per step.
 *
 * Every step writes straight to the real profile tables, so progress survives a
 * refresh, a different device, or closing the tab halfway through — there is no
 * separate draft that could drift from the profile it is filling in.
 */
export function OnboardingFlow({ allergens, profile, returnTo = null, step }: OnboardingFlowProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.onboarding;
  const f = t.fields;

  const options = {
    activity: ACTIVITY_VALUES.map(value => ({ ...t.options.activity[value], value })),
    budget: BUDGET_VALUES.map(value => ({ ...t.options.budget[value], value })),
    cookingFrequency: COOKING_FREQUENCY_VALUES.map(value => ({ label: t.options.cookingFrequency[value], value })),
    countries: COUNTRY_VALUES.map(value => ({ label: t.options.countries[value], value })),
    dietaryPatterns: DIETARY_PATTERN_VALUES.map(value => ({ label: t.options.dietaryPatterns[value], value })),
    goals: GOAL_VALUES.map(value => ({ ...t.options.goals[value], value })),
    sex: SEX_VALUES.map(value => ({ label: t.options.sex[value], value }))
  };
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, readonly string[]>>({});
  const [saving, setSaving] = useState(false);
  // Every step is server-rendered, so a navigation is a round trip that takes
  // as long as the save did. Run it as a transition and `navigating` stays true
  // until the next step is actually on screen — which is what keeps the spinner
  // on the button that long. Before this, the spinner stopped when the save
  // returned and the screen sat unchanged for the whole navigation: the exact
  // picture of an app that has hung.
  const [navigating, startNavigation] = useTransition();
  // Which button was pressed, so the spinner lands on that one and not both.
  const [heading, setHeading] = useState<'back' | 'forward'>('forward');
  const pending = saving || navigating;
  const advancing = saving || (navigating && heading === 'forward');
  const retreating = navigating && heading === 'back';

  // Which way the reader is travelling, so the step that arrives comes from the
  // side they are going. Direction is the whole information content of a
  // shared-axis transition; without it the motion is decoration.
  //
  // Derived from the prop during render rather than kept in a ref, which is the
  // pattern React documents for "state that depends on a prop changing" — and
  // the one the lint rule is protecting.
  const [travel, setTravel] = useState({ goingBack: false, step });

  if (travel.step !== step) {setTravel({ goingBack: step < travel.step, step });}

  const goingBack = travel.step === step ? travel.goingBack : step < travel.step;
  const current = FLOW[step - 1];
  const copy = current ? t.steps[current.copy] : undefined;
  const isReview = current?.key === 'review';
  const goal = profile?.goal;
  const preferences = profile?.preferences;
  const person = profile?.profile;

  function fieldError(name: string): string | undefined {
    return fieldErrors[name]?.[0];
  }

  /**
   * The one rule the browser will not enforce for us. The form is `noValidate`,
   * so `max` on the input is advice rather than a gate — on iOS not even that —
   * and the API's copy of the rule answers in its own language. Same bound the
   * schema holds the request to, in the reader's words, before it is sent.
   */
  function localErrors(payload: Record<string, unknown>): Record<string, readonly string[]> {
    const pace = payload.paceKgPerWeek;

    if (current?.key === 'goal' && typeof pace === 'number' && !(pace >= PACE_KG_PER_WEEK.min && pace <= PACE_KG_PER_WEEK.max)) {
      return { paceKgPerWeek: [f.paceRange] };
    }

    return {};
  }

  function buildPayload(form: FormData): Record<string, unknown> {
    const text = (key: string) => {
      const value = form.get(key);

      return value === null || value === '' ? null : String(value);
    };

    const number = (key: string) => {
      const value = form.get(key);

      return value === null || value === '' ? null : Number(value);
    };

    switch (current?.key) {
      case 'about-you':
        return { birthDate: text('birthDate'), displayName: text('displayName'), sex: text('sex') };

      case 'goal':
        return { customGoal: text('customGoal'), paceKgPerWeek: number('paceKgPerWeek'), targetWeightKg: number('targetWeightKg'), type: text('type') };

      case 'body-activity':
        return { activityLevel: text('activityLevel'), currentWeightKg: number('currentWeightKg'), heightCm: number('heightCm') };

      case 'how-you-eat':
        return {
          breakfastStyle: text('breakfastStyle'),
          // One radio group per slot, so the whole shape arrives in this submit.
          mealShape: Object.fromEntries(MEAL_SLOT_VALUES.map(slot => [slot, form.get(`shape.${slot}`) ?? 'off'])),
          portionPreference: text('portionPreference')
        };

      case 'food-preferences':
        return {
          cuisines: form.getAll('cuisines').map(String),
          preferences: [
            ...splitList(text('liked')).map(label => ({ label, sentiment: 'liked' as const })),
            ...splitList(text('disliked')).map(label => ({ label, sentiment: 'disliked' as const }))
          ]
        };

      case 'allergies':
        return {
          allergies: form.getAll('allergy').map(id => ({
            allergenId: String(id),
            crossContaminationSensitive: form.getAll('trace').includes(String(id)),
            severity: 'moderate' as const
          })),
          customAllergens: splitList(text('customAllergens')),
          dietaryPatterns: form.getAll('dietaryPatterns').map(String),
          intolerances: form.getAll('intolerance').map(id => ({ allergenId: String(id) }))
        };

      case 'lifestyle':
        return {
          sleepEnd: text('sleepEnd'),
          sleepStart: text('sleepStart'),
          trainingDaysPerWeek: number('trainingDaysPerWeek'),
          trainingTime: text('trainingTime'),
          workScheduleNotes: text('workScheduleNotes')
        };

      case 'cooking':
        return { budget: text('budget'), cookingFrequency: text('cookingFrequency'), cookingTimeMinutes: number('cookingTimeMinutes') };

      default:
        return {};
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldErrors({});

    const payload = buildPayload(new FormData(event.currentTarget));
    const problems = localErrors(payload);

    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      setError(dictionary.errors.invalidInput);

      return;
    }

    setHeading('forward');
    setSaving(true);

    try {
      if (isReview) {
        await api('/onboarding/complete', { method: 'POST' });
        startNavigation(() => {
          router.push('/inicio');
          router.refresh();
        });

        return;
      }

      await api('/onboarding', { body: { data: payload, step: current?.key }, method: 'PATCH' });
      startNavigation(() => {
        router.push(returnTo ?? `/onboarding/${step + 1}`);
        // The step just saved is now stale in the client router cache. Without
        // this, going back to it re-renders the payload fetched *before* the
        // save and the fields show the old answers — which looks exactly like
        // the save having failed.
        router.refresh();
      });
    } catch (caught) {
      if (caught instanceof ApiError) {setFieldErrors(caught.fieldErrors);}

      setError(messageFor(caught, dictionary));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.progress}>
        <div className={styles.progressMeta}>
          <Text size="sm" tone="secondary">
            {interpolate(t.stepOf, { current: step, total: TOTAL_STEPS })}
          </Text>
          <Text size="sm" tone="tertiary">
            {interpolate(t.percent, { value: Math.round((step / TOTAL_STEPS) * 100) })}
          </Text>
        </div>
        <div
          aria-label={t.progressLabel}
          aria-valuemax={TOTAL_STEPS}
          aria-valuemin={1}
          aria-valuenow={step}
          className={styles.track}
          role="progressbar"
        >
          <div className={styles.bar} style={{ inlineSize: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <h1 className={styles.title}>{copy?.title}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {copy?.subtitle}
      </Text>

      <form className={`${styles.fields} ${goingBack ? 'motion-back' : 'motion-forward'}`} key={step} noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {current?.key === 'about-you' ? (
          <Fragment>
            {/* `nickname`, not `name`: the question is what to call you, and
                the browser has a token for exactly that. Height, weight and pace
                have none — an invented token autofills nothing and claims a
                purpose that is not the field's. */}
            <Input autoComplete="nickname" defaultValue={person?.displayName ?? ''} error={fieldError('displayName')} label={f.displayName} name="displayName" />
            {/* Asked now that something reads it: the catalogue knows which of
                its foods are sold only in Spain, and a plan is built from what
                this person can actually buy (`0034`). Two options, because two
                is what the catalogue can serve — a longer list would be the
                question whose answer changes nothing that `0025` warns about. */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.country}</legend>
              <OptionCards name="country" options={options.countries} value={person?.country ?? undefined} />
              <Text className={styles.hint} size="xs" tone="tertiary">
                {f.countryHint}
              </Text>
            </fieldset>
            <Input autoComplete="bday" defaultValue={person?.birthDate ?? ''} error={fieldError('birthDate')} label={f.birthDate} name="birthDate" type="date" />
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.sex}</legend>
              <OptionCards name="sex" options={options.sex} value={person?.sex} />
              <Text className={styles.hint} size="xs" tone="tertiary">
                {f.sexHint}
              </Text>
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'goal' ? (
          <Fragment>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.goalType}</legend>
              <OptionCards name="type" options={options.goals} value={goal?.type} />
            </fieldset>
            <div className={styles.row}>
              <Input
                defaultValue={goal?.targetWeightKg ?? ''}
                error={fieldError('targetWeightKg')}
                label={f.targetWeightKg}
                name="targetWeightKg"
                step="0.1"
                type="number"
              />
              <Input
                defaultValue={goal?.paceKgPerWeek ?? ''}
                error={fieldError('paceKgPerWeek')}
                hint={f.paceHint}
                label={f.pace}
                max={PACE_KG_PER_WEEK.max}
                min={PACE_KG_PER_WEEK.min}
                name="paceKgPerWeek"
                step="0.05"
                type="number"
              />
            </div>
            <Input defaultValue={goal?.customGoal ?? ''} label={f.customGoal} name="customGoal" />
          </Fragment>
        ) : null}

        {current?.key === 'body-activity' ? (
          <Fragment>
            <div className={styles.row}>
              <Input defaultValue={person?.heightCm ?? ''} error={fieldError('heightCm')} label={f.heightCm} name="heightCm" type="number" />
              <Input
                defaultValue={goal?.startingWeightKg ?? ''}
                error={fieldError('currentWeightKg')}
                label={f.weightKg}
                name="currentWeightKg"
                step="0.1"
                type="number"
              />
            </div>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.activityLevel}</legend>
              <OptionCards name="activityLevel" options={options.activity} value={preferences?.activityLevel} />
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'how-you-eat' ? (
          <Fragment>
            {/* Which meals, and how big — one question instead of a count and a
                checkbox that between them could not say "I skip breakfast" (`0036`). */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.mealShape}</legend>
              <MealShapePicker labels={{ sizes: t.options.mealSizes, slots: t.options.mealSlots }} value={preferences?.mealShape ?? DEFAULT_SHAPE} />
              <Text className={styles.hint} size="xs" tone="tertiary">
                {f.mealShapeHint}
              </Text>
            </fieldset>
            <Input defaultValue={preferences?.breakfastStyle ?? ''} label={f.breakfastStyle} name="breakfastStyle" />
            <Input defaultValue={preferences?.portionPreference ?? ''} label={f.portionPreference} name="portionPreference" />
          </Fragment>
        ) : null}

        {current?.key === 'food-preferences' ? (
          <Fragment>
            <Input
              defaultValue={joinList(profile?.foodPreferences, 'liked')}
              hint={f.likedHint}
              label={f.liked}
              name="liked"
            />
            <Input
              defaultValue={joinList(profile?.foodPreferences, 'disliked')}
              hint={f.dislikedHint}
              label={f.disliked}
              name="disliked"
            />
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.cuisines}</legend>
              <ChipGroup name="cuisines" options={CUISINES} selected={profile?.cuisines ?? []} />
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'allergies' ? (
          <Fragment>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.allergies}</legend>
              <Text className={styles.hint} size="xs" tone="tertiary">
                {f.traceHint}
              </Text>
              {allergens.map(allergen => (
                <div className={styles.allergen} key={allergen.id}>
                  <Checkbox
                    defaultChecked={profile?.allergies.some(a => a.allergenId === allergen.id)}
                    label={allergen.labelEs}
                    name="allergy"
                    value={allergen.id}
                  />
                  {/* Fourteen boxes all called "trazas" are fourteen identical
                      stops in a rotor list; the visible word stays short and the
                      label says which allergen this one belongs to. */}
                  <label className={styles.allergenTrace}>
                    <input
                      aria-label={interpolate(f.traceLabelFor, { allergen: allergen.labelEs })}
                      defaultChecked={profile?.allergies.some(a => a.allergenId === allergen.id && a.crossContaminationSensitive)}
                      name="trace"
                      type="checkbox"
                      value={allergen.id}
                    />{' '}
                    {f.traceLabel}
                  </label>
                </div>
              ))}
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.intolerances}</legend>
              <ChipGroup
                name="intolerance"
                options={allergens.map(allergen => ({ label: allergen.labelEs, value: allergen.id }))}
                selected={(profile?.intolerances ?? []).map(intolerance => intolerance.allergenId)}
              />
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.otherAllergies}</legend>
              <Input
                defaultValue={(profile?.customAllergens ?? []).map(entry => entry.label).join(', ')}
                hint={f.customAllergensHint}
                label={f.customAllergens}
                name="customAllergens"
              />

              {/* Status per entry, never a summary. "Tus alergias están cubiertas"
                  would be true of the matched ones and a lie about the rest, and
                  the reader has no way to tell which half they are in. */}
              {(profile?.customAllergens ?? []).map(entry => (
                <p className={entry.ingredientName ? styles.enforced : styles.bestEffort} key={entry.label}>
                  <strong>{entry.label}</strong>{' '}
                  {entry.ingredientName ? interpolate(t.customAllergen.enforced, { ingredient: entry.ingredientName }) : t.customAllergen.bestEffort}
                </p>
              ))}
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.dietaryPatterns}</legend>
              <ChipGroup name="dietaryPatterns" options={options.dietaryPatterns} selected={profile?.dietaryPatterns ?? []} />
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'lifestyle' ? (
          <Fragment>
            <div className={styles.row}>
              <Input defaultValue={preferences?.sleepStart ?? ''} label={f.sleepStart} name="sleepStart" type="time" />
              <Input defaultValue={preferences?.sleepEnd ?? ''} label={f.sleepEnd} name="sleepEnd" type="time" />
            </div>
            <div className={styles.row}>
              <Input
                defaultValue={preferences?.trainingDaysPerWeek ?? 0}
                label={f.trainingDays}
                max="7"
                min="0"
                name="trainingDaysPerWeek"
                type="number"
              />
              <Input defaultValue={preferences?.trainingTime ?? ''} label={f.trainingTime} name="trainingTime" type="time" />
            </div>
            <Input defaultValue={preferences?.workScheduleNotes ?? ''} label={f.workScheduleNotes} name="workScheduleNotes" />
          </Fragment>
        ) : null}

        {current?.key === 'cooking' ? (
          <Fragment>
            <Input
              defaultValue={preferences?.cookingTimeMinutes ?? 30}
              hint={f.cookingTimeHint}
              label={f.cookingTime}
              max="240"
              min="5"
              name="cookingTimeMinutes"
              type="number"
            />
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.cookingFrequency}</legend>
              <OptionCards name="cookingFrequency" options={options.cookingFrequency} value={preferences?.cookingFrequency} />
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{f.budget}</legend>
              <OptionCards name="budget" options={options.budget} value={preferences?.budget} />
            </fieldset>
          </Fragment>
        ) : null}

        {isReview ? (
          <div className={styles.summary}>
            <SummaryRow label={t.review.name} value={person?.displayName} />
            <SummaryRow label={t.review.birthDate} value={person?.birthDate} />
            <SummaryRow label={t.review.height} value={person?.heightCm ? `${formatNumber(person.heightCm, locale)} cm` : undefined} />
            <SummaryRow
              label={t.review.weight}
              value={goal?.startingWeightKg ? `${formatNumber(goal.startingWeightKg, locale)} ${dictionary.units.kilogram}` : undefined}
            />
            <SummaryRow label={t.review.objective} value={goal?.type ? dictionary.goals[goal.type] : undefined} />
            <SummaryRow
              label={t.review.activity}
              value={preferences?.activityLevel ? dictionary.activity[preferences.activityLevel] : undefined}
            />
            <SummaryRow
              label={t.review.mealShape}
              value={preferences?.mealShape ? MEAL_SLOT_VALUES.filter(slot => preferences.mealShape[slot] !== 'off').map(slot => t.options.mealSlots[slot]).join(', ') : undefined}
            />
            <SummaryRow label={t.review.allergies} value={profile?.allergies.map(a => a.allergenLabel).join(', ') || dictionary.common.none} />
            <SummaryRow label={t.review.intolerances} value={profile?.intolerances.map(i => i.allergenLabel).join(', ') || dictionary.common.none} />
            <SummaryRow label={t.review.cuisines} value={profile?.cuisines.join(', ') || t.review.noCuisinePreference} />

            {profile?.targets ? (
              <div className={styles.targetsBox}>
                <Text size="sm" weight="semibold">
                  {t.review.targets}
                </Text>
                <Text size="sm" tone="secondary">
                  {interpolate(t.review.targetsLine, {
                    carbs: formatNumber(profile.targets.effective.carbsG, locale),
                    fat: formatNumber(profile.targets.effective.fatG, locale),
                    kcal: formatNumber(profile.targets.effective.kcal, locale),
                    protein: formatNumber(profile.targets.effective.proteinG, locale)
                  })}
                </Text>
                {/* The basis, on the screen where the number is first seen. This
                    is where 4,099 kcal for a weight-loss goal sat unquestioned. */}
                <Text size="xs" style={{ marginTop: 'var(--space-03)' }} tone="secondary">
                  {interpolate(t.review.basis, { maintenance: formatNumber(profile.targets.derivation.maintenanceKcal, locale) })}
                  {profile.targets.derivation.goal === 'weight_loss'
                    ? interpolate(t.review.basisLoss, { pace: formatNumber(profile.targets.derivation.paceKgPerWeek, locale) })
                    : null}
                  {profile.targets.derivation.goal === 'muscle_gain'
                    ? interpolate(t.review.basisGain, { pace: formatNumber(profile.targets.derivation.paceKgPerWeek, locale) })
                    : null}
                  {t.review.basisTail}
                </Text>
                {profile.targets.derivation.clampedBy ? (
                  <Text size="xs" style={{ marginTop: 'var(--space-03)' }} tone="secondary">
                    {interpolate(t.review.clamped, { requested: formatNumber(profile.targets.derivation.requestedKcal, locale) })}
                  </Text>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.actions}>
          <Button
            disabled={(step === 1 && !returnTo) || pending}
            loading={retreating}
            onClick={() => {
              setHeading('back');
              startNavigation(() => router.push(returnTo ?? `/onboarding/${step - 1}`));
            }}
            type="button"
            variant="secondary"
          >
            {returnTo ? dictionary.common.cancel : dictionary.common.back}
          </Button>
          <Button disabled={pending} loading={advancing} type="submit">
            {advancing ? dictionary.common.saving : returnTo ? dictionary.common.save : isReview ? dictionary.common.finish : dictionary.common.continue}
          </Button>
        </div>

        {/* Says exactly when the saving happens, not just that it does. "We save
            as you go" would be a lie for the step someone abandons half-typed,
            and being wrong about this is how people lose an answer and stop
            trusting the rest. */}
        {isReview ? null : (
          <Text className={styles.saveNote} size="xs" tone="tertiary">
            {t.saveNote}
          </Text>
        )}
      </form>
    </div>
  );
}


function splitList(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function joinList(preferences: FullProfileView['foodPreferences'] | undefined, sentiment: 'disliked' | 'liked'): string {
  return (preferences ?? [])
    .filter(preference => preference.sentiment === sentiment)
    .map(preference => preference.label)
    .join(', ');
}
