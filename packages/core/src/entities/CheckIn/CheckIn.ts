import { z } from 'zod';

import { WEIGHT_KG } from 'core/entities/Progress';

/** How the portions felt over the fortnight. */
export const HUNGER_ANSWERS = ['hungry', 'right', 'too_much'] as const;
export type HungerAnswer = (typeof HUNGER_ANSWERS)[number];

/** How hard the plan was to follow. */
export const DIFFICULTY_ANSWERS = ['easy', 'ok', 'hard'] as const;
export type DifficultyAnswer = (typeof DIFFICULTY_ANSWERS)[number];

/** How the three-way answers are stored — a small integer, so the columns stay numeric. */
export const HUNGER_RATING: Record<HungerAnswer, number> = { hungry: 1, right: 2, too_much: 3 };
export const DIFFICULTY_RATING: Record<DifficultyAnswer, number> = { easy: 1, hard: 3, ok: 2 };

export function hungerAnswer(rating: number | null): HungerAnswer | null {
  return HUNGER_ANSWERS.find(answer => HUNGER_RATING[answer] === rating) ?? null;
}

export function difficultyAnswer(rating: number | null): DifficultyAnswer | null {
  return DIFFICULTY_ANSWERS.find(answer => DIFFICULTY_RATING[answer] === rating) ?? null;
}

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
