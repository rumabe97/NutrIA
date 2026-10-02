import { formatQuantity, interpolate } from './format';

import type { Dictionary } from '../i18n/dictionaries/es-ES';
import type { Locale } from '../i18n/config';
import type { MealDetailView } from 'core/controllers/Plan';

/** One thing beside the plate, as the API sends it (`0079`, Table 3). */
export type MealAccompaniment = MealDetailView['accompaniments'][number];

const NO_BREAK_SPACE = ' ';

/**
 * How a side reads in a line, "pan (60 g)", "ensalada verde", "una naranja": the
 * dictionary decides which ones carry a weight, because a piece of fruit is
 * counted and a bread is weighed. A key the dictionary does not know yet reads as
 * the API's own name, so a side added to the list never blanks a row.
 */
export function accompanimentPhrase(side: MealAccompaniment, dictionary: Dictionary, locale: Locale): string {
  const names: Readonly<Record<string, string>> = dictionary.meal.accompanimentNames;
  const phrase = names[side.key];

  if (!phrase) {
    return side.name;
  }

  return interpolate(phrase, { grams: formatQuantity(side.grams, 'g', locale, dictionary).replace(' ', NO_BREAK_SPACE) });
}

/** A phrase to head a block with: the same words, starting a sentence. */
export function accompanimentTitle(side: MealAccompaniment, dictionary: Dictionary, locale: Locale): string {
  const phrase = accompanimentPhrase(side, dictionary, locale);

  return phrase.charAt(0).toLocaleUpperCase(locale) + phrase.slice(1);
}
