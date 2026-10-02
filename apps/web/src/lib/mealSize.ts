import { MEAL_SLOTS } from 'core/entities/Plan';

import { formatNumber, interpolate } from './format';

import type { Dictionary } from '../i18n/dictionaries/es-ES';
import type { Locale } from '../i18n/config';
import type { MealShape } from 'core/entities/Profile';

/** Which of the two places a person has answered the note: generating, or the profile. */
export type MealSizeAnswer = 'dismissed' | 'kept';

const PREFIX = 'nutria:mealSize';

const listeners = new Set<() => void>();

/** How many meals a day the shape has: every slot that is not off. */
export function mealCount(shape: MealShape): number {
  return MEAL_SLOTS.filter(slot => shape[slot] !== 'off').length;
}

/**
 * What an answer is about: the biggest main meal and the shape it came from.
 * Either changing is a different situation, so the note is asked again.
 */
export function mealSizeKey(largestMainKcal: number, shape: MealShape): string {
  return `${largestMainKcal}:${MEAL_SLOTS.map(slot => shape[slot]).join(',')}`;
}

/** The note's sentence, with the figure rounded to ten: "about" is in the words. */
export function mealSizeBody(dictionary: Dictionary, locale: Locale, count: number, kcal: number): string {
  return interpolate(dictionary.mealSize.body, { count: String(count), kcal: formatNumber(Math.round(kcal / 10) * 10, locale) });
}

function storageKey(answer: MealSizeAnswer, key: string): string {
  return `${PREFIX}:${answer}:${key}`;
}

export function subscribeMealSizeAnswers(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function hasMealSizeAnswer(answer: MealSizeAnswer, key: string): boolean {
  try {
    return localStorage.getItem(storageKey(answer, key)) !== null;
  } catch {
    // Storage blocked: the note is simply asked every time.
    return false;
  }
}

export function rememberMealSizeAnswer(answer: MealSizeAnswer, key: string): void {
  try {
    localStorage.setItem(storageKey(answer, key), '1');
  } catch {
    // Not remembered; nothing else depends on it.
  }

  listeners.forEach(listener => listener());
}
