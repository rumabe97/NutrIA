import { normaliseForMatching } from 'core/domain/Safety';

/**
 * The state a trailing word says a food is in. Raw and fresh are one state —
 * what a bare slug means — while cooked and dried each change what a gram
 * carries (cooked quinoa has a third of raw's kcal), so neither is ever read
 * as the other, nor a model's `-cocido` as a bare slug.
 */
type State = 'cooked' | 'dried' | 'raw';

/**
 * A word a model adds to a slug it was shown — `perejil-fresco` for
 * `perejil` — dropped once from the end before two slugs are compared, with
 * the state it names. A fixed list, because a wider one starts turning one
 * food into another.
 */
const TRAILING_QUALIFIERS: ReadonlyMap<string, State> = new Map([
  ...['cocida', 'cocidas', 'cocido', 'cocidos'].map(word => [word, 'cooked'] as const),
  ...['cruda', 'crudas', 'crudo', 'crudos', 'fresca', 'frescas', 'fresco', 'frescos', 'natural'].map(word => [word, 'raw'] as const),
  ...['seca', 'secas', 'seco', 'secos'].map(word => [word, 'dried'] as const)
]);

interface Reading {
  readonly state: State | null;
  readonly words: readonly string[];
}

/** A slug as the words it is compared by — accents and case folded, one trailing qualifier dropped — and the state that qualifier named. */
function read(slug: string): Reading {
  const parts = normaliseForMatching(slug).split(' ').filter(Boolean);
  const state = parts.length > 1 ? TRAILING_QUALIFIERS.get(parts.at(-1) ?? '') : undefined;

  return state === undefined ? { state: null, words: parts } : { state, words: parts.slice(0, -1) };
}

/** One word against another, singular or plural: `tomate`/`tomates`, `limon`/`limones`. */
function sameWord(a: string, b: string): boolean {
  return a === b || a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;
}

function sameWords(a: Reading, b: Reading): boolean {
  return a.words.length === b.words.length && a.words.every((word, index) => sameWord(word, b.words[index] ?? ''));
}

/**
 * Whether a model's slug may be read as a catalogue slug: the same words and
 * no state in conflict. A state the model wrote must be the candidate's —
 * except raw, which a bare slug already means. A bare reading may land on any
 * state; when twins compete for it, the uniqueness rule refuses it.
 */
function readsAs(wanted: Reading, candidate: string): boolean {
  const theirs = read(candidate);
  const states = wanted.state === null || wanted.state === theirs.state || (wanted.state === 'raw' && theirs.state === null);

  return states && sameWords(wanted, theirs);
}

/**
 * The slug a model meant, when it wrote a near miss of one it was shown —
 * or null.
 *
 * A model shown `perejil` writes back `perejil-fresco`, and the dish was
 * dropped as an unknown ingredient: 15–30% of what a fortnight rejected.
 * This reads the slug as its words — accents and case folded, one trailing
 * state word from a fixed list dropped, each word singular or plural — and
 * returns the one slug of `shown` that reads the same.
 *
 * Only `shown` is a target: the slugs the request's own prompt listed, which
 * were already cut to what this person may and would eat. And only when
 * **exactly one** slug of the whole catalogue — `known`, shown or not — reads
 * the same: `quinoa` beside `quinoa-cruda` and `quinoa-cocida`, or
 * `pastas-frescas` beside a shown `pasta` and an unshown `pasta-fresca`, is a
 * guess, and a guess is left unknown. The slug returned is then an ordinary
 * slug, and every gate the caller runs — allergy, preferences, meal — runs on
 * it as on any other.
 */
export function repairSlug(slug: string, shown: readonly string[], known: Iterable<string> = shown): string | null {
  const wanted = read(slug);

  if (wanted.words.length === 0) {
    return null;
  }

  const matches = new Set([...known, ...shown].filter(candidate => readsAs(wanted, candidate)));
  const [meant] = matches;

  return matches.size === 1 && meant !== undefined && shown.includes(meant) ? meant : null;
}

/**
 * Pairs of catalogue slugs the repair reads as one food in one state —
 * `perejil` and `perejil-fresco` — so that a model's near miss of either is a
 * guess. Twins in different states (`quinoa-cruda`, `quinoa-cocida`) are not
 * a pair: they are meant to differ. The seed's test holds this to none.
 *
 * @knipignore Exported for the seed catalogue's test.
 */
export function collidingSlugs(slugs: readonly string[]): readonly (readonly [string, string])[] {
  const readings = slugs.map(slug => [slug, read(slug)] as const);
  const pairs: (readonly [string, string])[] = [];

  for (const [index, [a, first]] of readings.entries()) {
    for (const [b, second] of readings.slice(index + 1)) {
      if ((first.state ?? 'raw') === (second.state ?? 'raw') && sameWords(first, second)) {
        pairs.push([a, b]);
      }
    }
  }

  return pairs;
}
