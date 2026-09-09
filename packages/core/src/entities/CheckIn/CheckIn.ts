import { z } from 'zod';

import { WEIGHT_KG } from 'core/entities/Progress';

/** How the portions felt over the fortnight. */
export const HUNGER_ANSWERS = ['hungry', 'right', 'too_much'] as const;
export type HungerAnswer = (typeof HUNGER_ANSWERS)[number];

/** How hard the plan was to follow. */
export const DIFFICULTY_ANSWERS = ['easy', 'ok', 'hard'] as const;
export type DifficultyAnswer = (typeof DIFFICULTY_ANSWERS)[number];

/**
 * The fortnight's check-in, once per plan
 * ([`0018`](../../../../docs/decisions/0018-the-fortnight-closes-with-a-check-in.md)).
 * Five answers, none of them a restriction: allergies and intolerances change
 * only through the profile, where they are enforced, never through free text.
 */
export const submitCheckInSchema = z.object({
  comments: z.string().trim().max(500).optional(),
  difficulty: z.enum(DIFFICULTY_ANSWERS),
  hunger: z.enum(HUNGER_ANSWERS),
  planId: z.uuid(),
  satisfaction: z.number().int().min(1).max(5),
  weightKg: z.number().min(WEIGHT_KG.min).max(WEIGHT_KG.max).nullish()
});

export type SubmitCheckIn = z.infer<typeof submitCheckInSchema>;
