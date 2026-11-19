import { interpolate } from './format';

import type { Dictionary } from 'i18n/dictionaries/es-ES';

/**
 * The server's word refusals (PRD 025, `0111` § 7): a field error that reads
 * `<list>:<word>` — `badge_only`, a word only the badge allows; `never`, a title
 * nobody may claim on NutrIA; `result`, a promised result. Each has its approved
 * sentence (`docs/legal/textos/01` § Pantallas P4), with the word quoted as the
 * person wrote it. Read by code, never by matching the API's message.
 */

const SENTENCES = { badge_only: 'profileWordRefused', never: 'profileWordNever', result: 'profilePromiseRefused' } as const;

type RefusalList = keyof typeof SENTENCES;

function isList(value: string): value is RefusalList {
  return value in SENTENCES;
}

/** The sentence for one field error, or null when the error is not a word refusal (a malformed value, say). */
export function wordRefusal(code: string | undefined, t: Dictionary['practice']): string | null {
  if (!code) {
    return null;
  }

  const colon = code.indexOf(':');
  const list = colon > 0 ? code.slice(0, colon) : '';

  if (!isList(list)) {
    return null;
  }

  return interpolate(t[SENTENCES[list]], { word: code.slice(colon + 1) });
}
