import { z } from 'zod';

/**
 * The conditions we offer as a choice, with stable keys.
 *
 * Offering a list is not a diagnosis and not advice — it is a vocabulary, so
 * that "celiaquía" and "celiaca" and "enfermedad celíaca" are one thing the
 * product can reason about instead of three strings. What a key *causes* is a
 * separate, curated decision that lives in `core/domain/Health`, and most keys
 * cause nothing.
 *
 * Anything not on this list is recorded as free text with a null key, and free
 * text produces no dietary inference whatsoever.
 */
export const HEALTH_CONDITIONS = [
  { key: 'coeliac', labelEs: 'Celiaquía' },
  { key: 'lactose_intolerance', labelEs: 'Intolerancia a la lactosa' },
  { key: 'type_1_diabetes', labelEs: 'Diabetes tipo 1' },
  { key: 'type_2_diabetes', labelEs: 'Diabetes tipo 2' },
  { key: 'hypertension', labelEs: 'Hipertensión' },
  { key: 'hypercholesterolemia', labelEs: 'Colesterol alto' },
  { key: 'ibs', labelEs: 'Síndrome de intestino irritable' },
  { key: 'gerd', labelEs: 'Reflujo gastroesofágico' },
  { key: 'hypothyroidism', labelEs: 'Hipotiroidismo' },
  { key: 'pcos', labelEs: 'Síndrome de ovario poliquístico' },
  { key: 'chronic_kidney_disease', labelEs: 'Enfermedad renal crónica' },
  { key: 'gout', labelEs: 'Gota' },
  { key: 'pregnancy', labelEs: 'Embarazo' },
  { key: 'breastfeeding', labelEs: 'Lactancia' }
] as const satisfies readonly { key: string; labelEs: string }[];

export type ConditionKey = (typeof HEALTH_CONDITIONS)[number]['key'];

export const CONDITION_KEYS = HEALTH_CONDITIONS.map(condition => condition.key) as readonly ConditionKey[];

/**
 * Bumped whenever the consent wording changes.
 *
 * A stored version that no longer matches this one is not consent to the
 * current notice, so the product asks again instead of assuming agreement to
 * wording the user never read.
 */
export const HEALTH_CONSENT_VERSION = '1.0.0';

export const healthConditionSchema = z.object({
  id: z.uuid(),
  conditionKey: z.enum(CONDITION_KEYS as [ConditionKey, ...ConditionKey[]]).nullable(),
  label: z.string().min(1)
});

export type HealthCondition = z.infer<typeof healthConditionSchema>;

export const medicationSchema = z.object({ id: z.uuid(), name: z.string().min(1) });

export type Medication = z.infer<typeof medicationSchema>;

export const supplementSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  proteinGPerServing: z.number().nullable(),
  servingsPerDay: z.number().int()
});

export type Supplement = z.infer<typeof supplementSchema>;

/**
 * The whole health section, replaced in one request.
 *
 * Replace-all rather than per-row edits, for the same reason allergies are:
 * removing something has to be expressible, and a partial update can only ever
 * add. Consent travels with it — sending health data *is* the act being
 * consented to, so the two cannot arrive separately.
 */
export const setHealthDataSchema = z.object({
  conditions: z
    .array(
      z.object({
        conditionKey: z.enum(CONDITION_KEYS as [ConditionKey, ...ConditionKey[]]).nullish(),
        label: z.string().trim().min(1).max(120)
      })
    )
    .max(20),
  /** Must be the current version. An older string is consent to a different notice. */
  consentVersion: z.literal(HEALTH_CONSENT_VERSION),
  medications: z.array(z.object({ name: z.string().trim().min(1).max(120) })).max(30),
  supplements: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        proteinGPerServing: z.number().min(0).max(200).nullish(),
        servingsPerDay: z.number().int().min(1).max(10).default(1)
      })
    )
    .max(20)
});

export type SetHealthData = z.infer<typeof setHealthDataSchema>;
