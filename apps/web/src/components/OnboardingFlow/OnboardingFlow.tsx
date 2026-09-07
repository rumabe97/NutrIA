'use client';
import { Fragment, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './OnboardingFlow.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';

import { ChipGroup } from 'components/ChipGroup';
import { OptionCards } from 'components/OptionCards';
import { SummaryRow } from 'components/SummaryRow';

import { api, ApiError, messageFor } from 'lib/api';

import { FLOW, TOTAL_STEPS } from './steps';

import type { Allergen } from 'core/entities/Safety';
import type { FormEvent } from 'react';
import type { FullProfileView } from 'core/controllers/Profile';

interface OnboardingFlowProps {
  allergens: readonly Allergen[];
  profile: FullProfileView | null;
  step: number;
}

const GOALS = [
  { hint: 'Reducir grasa manteniendo la masa muscular.', label: 'Perder peso', value: 'weight_loss' },
  { hint: 'Quedarte donde estás, comiendo mejor.', label: 'Mantenerme', value: 'maintenance' },
  { hint: 'Ganar músculo con un superávit controlado.', label: 'Ganar músculo', value: 'muscle_gain' },
  { hint: 'Comer para entrenar y recuperar mejor.', label: 'Rendimiento', value: 'performance' },
  { hint: 'Sin objetivo de peso, solo comer bien.', label: 'Comer sano', value: 'healthy_eating' },
  { hint: 'Cuéntanoslo con tus palabras.', label: 'Otro', value: 'custom' }
] as const;

const ACTIVITY = [
  { hint: 'Trabajo sentado, poco ejercicio.', label: 'Sedentario', value: 'sedentary' },
  { hint: 'Camino a diario o entreno 1–2 veces.', label: 'Ligero', value: 'light' },
  { hint: 'Entreno 3–4 veces por semana.', label: 'Moderado', value: 'moderate' },
  { hint: 'Entreno 5–6 veces o trabajo físico.', label: 'Alto', value: 'high' },
  { hint: 'Doble sesión o competición.', label: 'Deportista', value: 'athlete' }
] as const;

const SEXES = [
  { label: 'Mujer', value: 'female' },
  { label: 'Hombre', value: 'male' },
  { label: 'Otro', value: 'other' },
  { label: 'Prefiero no decirlo', value: 'prefer_not_to_say' }
] as const;

const COOKING_FREQUENCY = [
  { label: 'Casi nunca', value: 'rarely' },
  { label: 'A veces', value: 'sometimes' },
  { label: 'A menudo', value: 'often' },
  { label: 'A diario', value: 'daily' }
] as const;

const BUDGETS = [
  { hint: 'Básicos y marcas blancas.', label: 'Ajustado', value: 'low' },
  { hint: 'Sin pensarlo demasiado.', label: 'Normal', value: 'medium' },
  { hint: 'Producto fresco y de temporada.', label: 'Amplio', value: 'high' }
] as const;

const CUISINES = ['Mediterránea', 'Española', 'Italiana', 'Mexicana', 'Japonesa', 'India', 'Griega', 'Árabe', 'Tailandesa', 'Peruana'].map(name => ({
  label: name,
  value: name
}));

const DIETARY_PATTERNS = [
  { label: 'Sin restricción', value: 'omnivore' },
  { label: 'Vegetariana', value: 'vegetarian' },
  { label: 'Vegana', value: 'vegan' },
  { label: 'Pescetariana', value: 'pescatarian' },
  { label: 'Flexitariana', value: 'flexitarian' },
  { label: 'Sin gluten', value: 'gluten_free' },
  { label: 'Sin lactosa', value: 'lactose_free' },
  { label: 'Halal', value: 'halal' },
  { label: 'Kosher', value: 'kosher' }
] as const;

/**
 * One step per screen, one PATCH per step.
 *
 * Every step writes straight to the real profile tables, so progress survives a
 * refresh, a different device, or closing the tab halfway through — there is no
 * separate draft that could drift from the profile it is filling in.
 */
export function OnboardingFlow({ allergens, profile, step }: OnboardingFlowProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, readonly string[]>>({});
  const [pending, setPending] = useState(false);

  const current = FLOW[step - 1];
  const isReview = current?.key === 'review';
  const goal = profile?.goal;
  const preferences = profile?.preferences;
  const person = profile?.profile;

  function fieldError(name: string): string | undefined {
    return fieldErrors[name]?.[0];
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
        return { birthDate: text('birthDate'), country: text('country'), displayName: text('displayName'), sex: text('sex') };

      case 'goal':
        return { customGoal: text('customGoal'), paceKgPerWeek: number('paceKgPerWeek'), targetWeightKg: number('targetWeightKg'), type: text('type') };

      case 'body-activity':
        return { activityLevel: text('activityLevel'), currentWeightKg: number('currentWeightKg'), heightCm: number('heightCm') };

      case 'how-you-eat':
        return {
          breakfastStyle: text('breakfastStyle'),
          includesSnacks: form.get('includesSnacks') === 'on',
          mealsPerDay: number('mealsPerDay'),
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
    setPending(true);

    try {
      if (isReview) {
        await api('/onboarding/complete', { method: 'POST' });
        router.push('/inicio');
        router.refresh();

        return;
      }

      await api('/onboarding', { body: { data: buildPayload(new FormData(event.currentTarget)), step: current?.key }, method: 'PATCH' });
      router.push(`/onboarding/${step + 1}`);
    } catch (caught) {
      if (caught instanceof ApiError) {setFieldErrors(caught.fieldErrors);}

      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.progress}>
        <div className={styles.progressMeta}>
          <Text size="sm" tone="secondary">
            Paso {step} de {TOTAL_STEPS}
          </Text>
          <Text size="sm" tone="tertiary">
            {Math.round((step / TOTAL_STEPS) * 100)} %
          </Text>
        </div>
        <div
          aria-label="Progreso del cuestionario"
          aria-valuemax={TOTAL_STEPS}
          aria-valuemin={1}
          aria-valuenow={step}
          className={styles.track}
          role="progressbar"
        >
          <div className={styles.bar} style={{ inlineSize: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <h1 className={styles.title}>{current?.title}</h1>
      <Text className={styles.subtitle} tone="secondary">
        {current?.subtitle}
      </Text>

      <form className={styles.fields} noValidate={true} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {current?.key === 'about-you' ? (
          <Fragment>
            <Input defaultValue={person?.displayName ?? ''} error={fieldError('displayName')} label="¿Cómo quieres que te llamemos?" name="displayName" />
            <div className={styles.row}>
              <Input defaultValue={person?.birthDate ?? ''} error={fieldError('birthDate')} label="Fecha de nacimiento" name="birthDate" type="date" />
              <Input defaultValue={person?.country ?? 'ES'} hint="Código de dos letras." label="País" maxLength={2} name="country" />
            </div>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Sexo</legend>
              <OptionCards name="sex" options={SEXES} value={person?.sex} />
              <Text className={styles.hint} size="xs" tone="tertiary">
                Lo usamos solo para la ecuación metabólica. Si prefieres no decirlo, usamos el valor intermedio.
              </Text>
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'goal' ? (
          <Fragment>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>¿Qué quieres conseguir?</legend>
              <OptionCards name="type" options={GOALS} value={goal?.type} />
            </fieldset>
            <div className={styles.row}>
              <Input
                defaultValue={goal?.targetWeightKg ?? ''}
                error={fieldError('targetWeightKg')}
                label="Peso objetivo (kg)"
                name="targetWeightKg"
                step="0.1"
                type="number"
              />
              <Input
                defaultValue={goal?.paceKgPerWeek ?? ''}
                hint="Negativo para perder. Máximo 1 kg."
                label="Ritmo (kg por semana)"
                max="1"
                min="-1"
                name="paceKgPerWeek"
                step="0.05"
                type="number"
              />
            </div>
            <Input defaultValue={goal?.customGoal ?? ''} label="Si has elegido «Otro», descríbelo" name="customGoal" />
          </Fragment>
        ) : null}

        {current?.key === 'body-activity' ? (
          <Fragment>
            <div className={styles.row}>
              <Input defaultValue={person?.heightCm ?? ''} error={fieldError('heightCm')} label="Altura (cm)" name="heightCm" type="number" />
              <Input
                defaultValue={goal?.startingWeightKg ?? ''}
                error={fieldError('currentWeightKg')}
                label="Peso actual (kg)"
                name="currentWeightKg"
                step="0.1"
                type="number"
              />
            </div>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Nivel de actividad</legend>
              <OptionCards name="activityLevel" options={ACTIVITY} value={preferences?.activityLevel} />
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'how-you-eat' ? (
          <Fragment>
            <Input
              defaultValue={preferences?.mealsPerDay ?? 4}
              hint="Entre 2 y 6."
              label="Comidas al día"
              max="6"
              min="2"
              name="mealsPerDay"
              type="number"
            />
            <Checkbox defaultChecked={preferences?.includesSnacks ?? true} label="Incluir tentempiés entre comidas" name="includesSnacks" />
            <Input defaultValue={preferences?.breakfastStyle ?? ''} label="¿Cómo sueles desayunar?" name="breakfastStyle" />
            <Input defaultValue={preferences?.portionPreference ?? ''} label="¿Prefieres platos grandes o ligeros?" name="portionPreference" />
          </Fragment>
        ) : null}

        {current?.key === 'food-preferences' ? (
          <Fragment>
            <Input
              defaultValue={joinList(profile?.foodPreferences, 'liked')}
              hint="Separa con comas."
              label="Alimentos que te gustan"
              name="liked"
            />
            <Input
              defaultValue={joinList(profile?.foodPreferences, 'disliked')}
              hint="No volverán a aparecer en tus planes."
              label="Alimentos que no quieres ver"
              name="disliked"
            />
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Cocinas que te apetecen</legend>
              <ChipGroup name="cuisines" options={CUISINES} selected={profile?.cuisines ?? []} />
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'allergies' ? (
          <Fragment>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Alergias</legend>
              <Text className={styles.hint} size="xs" tone="tertiary">
                Marca «trazas» si también te afectan los productos que pueden contener el alérgeno.
              </Text>
              {allergens.map(allergen => (
                <div className={styles.allergen} key={allergen.id}>
                  <Checkbox
                    defaultChecked={profile?.allergies.some(a => a.allergenId === allergen.id)}
                    label={allergen.labelEs}
                    name="allergy"
                    value={allergen.id}
                  />
                  <label className={styles.allergenTrace}>
                    <input
                      defaultChecked={profile?.allergies.some(a => a.allergenId === allergen.id && a.crossContaminationSensitive)}
                      name="trace"
                      type="checkbox"
                      value={allergen.id}
                    />{' '}
                    trazas
                  </label>
                </div>
              ))}
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Intolerancias</legend>
              <ChipGroup
                name="intolerance"
                options={allergens.map(allergen => ({ label: allergen.labelEs, value: allergen.id }))}
                selected={(profile?.intolerances ?? []).map(intolerance => intolerance.allergenId)}
              />
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Tipo de alimentación</legend>
              <ChipGroup name="dietaryPatterns" options={DIETARY_PATTERNS} selected={profile?.dietaryPatterns ?? []} />
            </fieldset>
          </Fragment>
        ) : null}

        {current?.key === 'lifestyle' ? (
          <Fragment>
            <div className={styles.row}>
              <Input defaultValue={preferences?.sleepStart ?? ''} label="¿A qué hora te acuestas?" name="sleepStart" type="time" />
              <Input defaultValue={preferences?.sleepEnd ?? ''} label="¿A qué hora te levantas?" name="sleepEnd" type="time" />
            </div>
            <div className={styles.row}>
              <Input
                defaultValue={preferences?.trainingDaysPerWeek ?? 0}
                label="Días de entrenamiento por semana"
                max="7"
                min="0"
                name="trainingDaysPerWeek"
                type="number"
              />
              <Input defaultValue={preferences?.trainingTime ?? ''} label="¿A qué hora entrenas?" name="trainingTime" type="time" />
            </div>
            <Input defaultValue={preferences?.workScheduleNotes ?? ''} label="Algo de tu horario que debamos saber" name="workScheduleNotes" />
          </Fragment>
        ) : null}

        {current?.key === 'cooking' ? (
          <Fragment>
            <Input
              defaultValue={preferences?.cookingTimeMinutes ?? 30}
              hint="Por comida, entre 5 y 240."
              label="Minutos que puedes dedicar a cocinar"
              max="240"
              min="5"
              name="cookingTimeMinutes"
              type="number"
            />
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>¿Con qué frecuencia cocinas?</legend>
              <OptionCards name="cookingFrequency" options={COOKING_FREQUENCY} value={preferences?.cookingFrequency} />
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Presupuesto</legend>
              <OptionCards name="budget" options={BUDGETS} value={preferences?.budget} />
            </fieldset>
          </Fragment>
        ) : null}

        {isReview ? (
          <div className={styles.summary}>
            <SummaryRow label="Nombre" value={person?.displayName} />
            <SummaryRow label="Fecha de nacimiento" value={person?.birthDate} />
            <SummaryRow label="Altura" value={person?.heightCm ? `${person.heightCm} cm` : undefined} />
            <SummaryRow label="Peso actual" value={goal?.startingWeightKg ? `${goal.startingWeightKg} kg` : undefined} />
            <SummaryRow label="Objetivo" value={GOALS.find(item => item.value === goal?.type)?.label} />
            <SummaryRow label="Actividad" value={ACTIVITY.find(item => item.value === preferences?.activityLevel)?.label} />
            <SummaryRow label="Comidas al día" value={preferences?.mealsPerDay ? String(preferences.mealsPerDay) : undefined} />
            <SummaryRow label="Alergias" value={profile?.allergies.map(a => a.allergenLabel).join(', ') || 'Ninguna'} />
            <SummaryRow label="Intolerancias" value={profile?.intolerances.map(i => i.allergenLabel).join(', ') || 'Ninguna'} />
            <SummaryRow label="Cocinas" value={profile?.cuisines.join(', ') || 'Sin preferencia'} />

            {profile?.targets ? (
              <div className={styles.targetsBox}>
                <Text size="sm" weight="semibold">
                  Tus objetivos diarios
                </Text>
                <Text size="sm" tone="secondary">
                  {profile.targets.kcal} kcal · {profile.targets.proteinG} g proteína · {profile.targets.carbsG} g carbohidratos · {profile.targets.fatG} g
                  grasas
                </Text>
                {profile.targets.wasClamped ? (
                  <Text size="xs" style={{ marginTop: 'var(--space-03)' }} tone="secondary">
                    Hemos ajustado tu ritmo para no bajar del mínimo diario que consideramos seguro sin supervisión profesional.
                  </Text>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.actions}>
          <Button
            disabled={step === 1 || pending}
            onClick={() => router.push(`/onboarding/${step - 1}`)}
            type="button"
            variant="secondary"
          >
            Atrás
          </Button>
          <Button disabled={pending} type="submit">
            {pending ? 'Guardando…' : isReview ? 'Terminar' : 'Continuar'}
          </Button>
        </div>
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
