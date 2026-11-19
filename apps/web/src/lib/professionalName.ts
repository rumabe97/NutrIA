import { interpolate } from './format';

/**
 * The practitioner's name as a client reads it (PRD 025). The API sends
 * `professionalName: null` when the practitioner's account name may not be
 * shown; the client then reads the approved neutral words, «tu profesional» /
 * "your professional" (`care.professionalUnnamed`), and never a blank.
 *
 * Typed `string | null` here on purpose: the API's views gain the null in the
 * same project phase, and a screen that already takes it cannot be caught out.
 */

function capitalise(words: string): string {
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}

/** The name on its own, as a line of its own: the neutral words take a capital. */
export function professionalLabel(name: string | null | undefined, unnamed: string): string {
  return name ? name : capitalise(unnamed);
}

/**
 * A sentence with `{professional}` filled: the name, or the neutral words —
 * capitalised wherever `{professional}` opens the text or a sentence, so «A
 * {professional} solo le consta» and "{professional} only sees" both stay
 * grammatical without a second sentence to approve.
 */
export function withProfessional(
  template: string,
  name: string | null | undefined,
  unnamed: string,
  values: Readonly<Record<string, number | string>> = {}
): string {
  if (name) {
    return interpolate(template, { ...values, professional: name });
  }

  const opened = template.replace(/(^|[.!?]\s+)\{professional\}/g, (_match, lead: string) => `${lead}${capitalise(unnamed)}`);

  return interpolate(opened, { ...values, professional: unnamed });
}
