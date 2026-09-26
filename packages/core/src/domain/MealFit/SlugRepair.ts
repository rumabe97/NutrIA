import { normaliseForMatching } from 'core/domain/Safety';

/**
 * A word a model adds to a slug it was shown — `perejil-fresco` for
 * `perejil` — dropped once from the end before two slugs are compared. A
 * fixed list, because a wider one starts turning one food into another.
 */
const TRAILING_QUALIFIERS: ReadonlySet<string> = new Set(['cruda', 'crudo', 'fresca', 'frescas', 'fresco', 'frescos', 'natural']);

/** A slug as the words it is compared by: accents and case folded, one trailing qualifier dropped. */
function words(slug: string): readonly string[] {
  const parts = normaliseForMatching(slug).split(' ').filter(Boolean);
  const last = parts.at(-1);

  return parts.length > 1 && last !== undefined && TRAILING_QUALIFIERS.has(last) ? parts.slice(0, -1) : parts;
}

/** One word against another, singular or plural: `tomate`/`tomates`, `limon`/`limones`. */
function sameWord(a: string, b: string): boolean {
  return a === b || a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;
}

/**
 * The slug a model meant, when it wrote a near miss of one it was shown —
 * or null.
 *
 * A model shown `perejil` writes back `perejil-fresco`, and the dish was
 * dropped as an unknown ingredient: 15–30% of what a fortnight rejected.
 * This reads the slug as its words — accents and case folded, one trailing
 * qualifier from a fixed list dropped, each word singular or plural — and
 * returns the one slug of `shown` that reads the same.
 *
 * Only `shown`: the slugs the request's own prompt listed, which were already
 * cut to what this person may and would eat — never the whole catalogue. And
 * only **exactly one**: two candidates are a guess, and a guess is left
 * unknown. The slug returned is then an ordinary slug, and every gate the
 * caller runs — allergy, preferences, meal — runs on it as on any other.
 */
export function repairSlug(slug: string, shown: readonly string[]): string | null {
  const wanted = words(slug);

  if (wanted.length === 0) {
    return null;
  }

  const matches = new Set(
    shown.filter(candidate => {
      const theirs = words(candidate);

      return theirs.length === wanted.length && theirs.every((word, index) => sameWord(word, wanted[index] ?? ''));
    })
  );

  return matches.size === 1 ? ([...matches][0] ?? null) : null;
}
