import { MEAL_SLOTS } from 'core/entities/Plan';

import { formatNumber, interpolate } from './format';

import type { Dictionary } from '../i18n/dictionaries/es-ES';
import type { Locale } from '../i18n/config';
import type { MealShape } from 'core/entities/Profile';
import type { MealSizeView } from 'core/controllers/Profile';

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

/** The one change that would bring the biggest main meal down, and what it would come down to. */
export type MealSizeSuggestion = NonNullable<MealSizeView['suggestion']>;

function roundedKcal(kcal: number, locale: Locale): string {
  return formatNumber(Math.round(kcal / 10) * 10, locale);
}

function slotName(dictionary: Dictionary, locale: Locale, suggestion: MealSizeSuggestion): string {
  return suggestion.slot ? dictionary.onboarding.options.mealSlots[suggestion.slot].toLocaleLowerCase(locale) : '';
}

/**
 * The note's sentences, with the figures rounded to ten: "about" is in the words.
 * The second says the change and what it would bring the biggest meal to, or that
 * no change would.
 */
export function mealSizeBody(dictionary: Dictionary, locale: Locale, count: number, kcal: number, suggestion: MealSizeSuggestion | null): string {
  const base = interpolate(dictionary.mealSize.body, { count: String(count), kcal: roundedKcal(kcal, locale) });
  const { suggestions } = dictionary.mealSize;

  if (!suggestion) {
    return `${base} ${suggestions.none}`;
  }

  const rest = interpolate(suggestions[suggestion.change].body, {
    kcal: roundedKcal(suggestion.largestMainKcal, locale),
    slot: slotName(dictionary, locale, suggestion)
  });

  return `${base} ${rest}`;
}

/** The control that makes the suggested change, named for it; null when there is none to make. */
export function mealSizeAction(dictionary: Dictionary, locale: Locale, suggestion: MealSizeSuggestion | null): string | null {
  return suggestion
    ? interpolate(dictionary.mealSize.suggestions[suggestion.change].action, { slot: slotName(dictionary, locale, suggestion) })
    : null;
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
