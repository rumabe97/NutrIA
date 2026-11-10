/**
 * A buffer split into what may be checked and shown now, and what is still
 * being written.
 *
 * `released` ends on a sentence boundary — or is empty — and `remainder` is
 * everything after it. Nothing in `remainder` has been checked, so nothing in it
 * may reach a person until a later call releases it.
 */
export type SentenceSplit = { readonly released: string; readonly remainder: string };

/**
 * Words that end in a full stop without ending a sentence. Normalised: accents
 * off, lower case. A boundary is only ever taken when the next word starts in
 * upper case, so most abbreviations are safe without being listed — these are
 * the ones a sentence may legitimately continue after with a capital.
 */
const ABBREVIATIONS: ReadonlySet<string> = new Set(['aprox', 'approx', 'dr', 'dra', 'ej', 'etc', 'p', 'pag', 'sr', 'sra', 'srta', 'ud', 'uds', 'vs']);

/** What may start a new sentence: a capital, a digit, an opening mark, or a list's bullet. */
const STARTS_SENTENCE = /^[\p{Lu}\d¿¡"«(*•–—-]/u;

function lastWordBefore(text: string, index: number): string {
  const match = /([\p{L}]+)$/u.exec(text.slice(0, index));

  return (match?.[1] ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Where the last whole sentence in `buffer` ends, or `-1`.
 *
 * A boundary is:
 *
 * - **a line break** — a recipe is a list, and a list is released a line at a
 *   time;
 * - **`.`, `!`, `?` or `…`** (or a run of them, `...`, `?!`) followed by space
 *   and then something that starts a sentence — not a decimal (`2.5` has no
 *   space after its point), not «1 cda. de aceite» (lower case follows), and not
 *   a listed abbreviation («p. ej. Las lentejas…»).
 *
 * A mark at the very end of the buffer is **not** a boundary yet: whether it
 * ends a sentence depends on what comes next, and what comes next has not
 * arrived. It is released by a later call, or by `flushSentences` when the
 * answer ends.
 */
function lastBoundary(buffer: string): number {
  let boundary = -1;

  for (let index = 0; index < buffer.length; index += 1) {
    const char = buffer[index] ?? '';

    if (char === '\n') {
      boundary = index + 1;
      continue;
    }

    if (!/[.!?…]/.test(char)) {
      continue;
    }

    let end = index + 1;

    while (end < buffer.length && /[.!?…"»)]/.test(buffer[end] ?? '')) {
      end += 1;
    }

    const spaces = /^[ \t]+/.exec(buffer.slice(end));

    if (!spaces) {
      index = end - 1;
      continue;
    }

    const next = buffer.slice(end + spaces[0].length);

    if (next === '') {
      // The next word has not arrived: undecidable, so not yet.
      break;
    }

    const isAbbreviation = char === '.' && end === index + 1 && ABBREVIATIONS.has(lastWordBefore(buffer, index));

    if (STARTS_SENTENCE.test(next) && !isAbbreviation) {
      boundary = end + spaces[0].length;
    }

    index = end - 1;
  }

  return boundary;
}

/**
 * The whole sentences at the front of a buffer, ready for the checks, and the
 * rest — the release step of project 023's sentence-by-sentence answer (the
 * owner's choice of 2026-11-09).
 *
 * **This is a safety boundary.** What the route releases is what the checks
 * passed; a sentence the checks have not seen must stay in `remainder`, and the
 * tests for this function are the ways a careless splitter would let one out.
 */
export function releaseSentences(buffer: string): SentenceSplit {
  const boundary = lastBoundary(buffer);

  return boundary <= 0 ? { released: '', remainder: buffer } : { released: buffer.slice(0, boundary), remainder: buffer.slice(boundary) };
}

/** The end of the answer: whatever is left is the last sentence, ready for the checks. */
export function flushSentences(buffer: string): SentenceSplit {
  return { released: buffer, remainder: '' };
}
