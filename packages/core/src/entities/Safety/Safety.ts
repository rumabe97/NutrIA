import { z } from 'zod';

export const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe', 'anaphylaxis'] as const;

export const allergySchema = z.object({
  id: z.uuid(),
  allergenId: z.uuid(),
  allergenKey: z.string().min(1),
  allergenLabel: z.string().min(1),
  crossContaminationSensitive: z.boolean(),
  notes: z.string().nullable(),
  severity: z.enum(ALLERGY_SEVERITIES)
});

export type Allergy = z.infer<typeof allergySchema>;

export const intoleranceSchema = z.object({
  id: z.uuid(),
  allergenId: z.uuid(),
  allergenKey: z.string().min(1),
  allergenLabel: z.string().min(1),
  notes: z.string().nullable()
});

export type Intolerance = z.infer<typeof intoleranceSchema>;

export const allergenSchema = z.object({
  id: z.uuid(),
  isEuMandatory: z.boolean(),
  key: z.string().min(1),
  labelEs: z.string().min(1)
});

export type Allergen = z.infer<typeof allergenSchema>;

export const setAllergiesSchema = z.object({
  allergies: z
    .array(
      z.object({
        allergenId: z.uuid(),
        crossContaminationSensitive: z.boolean().default(false),
        notes: z.string().max(280).nullish(),
        severity: z.enum(ALLERGY_SEVERITIES).default('moderate')
      })
    )
    .max(20),
  intolerances: z.array(z.object({ allergenId: z.uuid(), notes: z.string().max(280).nullish() })).max(20)
});

export type SetAllergies = z.infer<typeof setAllergiesSchema>;

/**
 * The safety profile the validator works against. Assembled once per request and
 * passed down — never re-fetched inside a loop over meals, and never derived
 * from anything a model produced.
 */
export type SafetyProfile = {
  readonly allergenIds: ReadonlySet<string>;
  /** Subset of `allergenIds` whose owner also reacts to trace contamination. */
  readonly crossContaminationAllergenIds: ReadonlySet<string>;
  readonly intoleranceAllergenIds: ReadonlySet<string>;
};
