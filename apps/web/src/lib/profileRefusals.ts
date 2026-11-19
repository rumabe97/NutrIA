import { interpolate } from './format';
import { wordRefusal } from './protectedWord';

import type { Dictionary } from 'i18n/dictionaries/es-ES';

/** What a refused profile save says, field by field. */
export interface ProfileRefusals {
  displayName?: string;
  /** The day a refusal of the hours names (`hours.<day>…`), when it names one. */
  hoursDay?: number | null;
  price?: string;
  studies?: string;
}

/**
 * A refused `PUT /care/practice/profile` (`fieldErrors`), turned into one sentence
 * per refused field (PRD 025 scope 4): **every** field the API names, not only the
 * first — a word in the approved sentence for its list (`lib/protectedWord`),
 * anything else in the plain instruction for that field (`practice.fieldError`).
 * `hoursDay` is `undefined` when the hours were not refused, `null` when they were
 * without naming a day.
 */
export function profileRefusals(
  fieldErrors: Readonly<Record<string, readonly string[]>>,
  t: Dictionary['practice'],
  studiesMax: number
): ProfileRefusals {
  const first = (name: string) => fieldErrors[name]?.[0];
  const refusals: ProfileRefusals = {};
  const displayName = first('displayName');
  const studies = first('studies');

  if (displayName) {
    refusals.displayName = wordRefusal(displayName, t) ?? t.fieldError.displayName;
  }

  if (studies) {
    refusals.studies = wordRefusal(studies, t) ?? interpolate(t.fieldError.studies, { max: studiesMax });
  }

  if (first('priceCents') || first('priceUnit')) {
    refusals.price = t.fieldError.price;
  }

  const hours = Object.keys(fieldErrors).filter(key => key.startsWith('hours'));

  if (hours.length > 0) {
    const day = hours.map(key => /^hours\.(\d+)/.exec(key)).find(match => match !== null);

    refusals.hoursDay = day ? Number(day[1]) : null;
  }

  return refusals;
}
