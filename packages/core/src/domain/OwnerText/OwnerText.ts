/**
 * The owner's free text — the facts of a statement of reasons (`docs/legal/textos/06`
 * §§ W, W bis, X) — made safe to show and made a sentence. One definition for
 * every place that says it: the mails the API sends, and the practitioner's
 * own screens, which must read the same.
 *
 * Pure text, no I/O. An HTML renderer still escapes what these return.
 */

/** The longest facts the owner's words carry; the schemas already bound them. */
export const OWNER_TEXT_LIMIT = 1000;

/**
 * The owner's words as plain text, whatever was typed: control characters and
 * markup removed, whitespace folded to single spaces, bounded. An HTML part
 * escapes them again; this is what keeps a plain-text part one paragraph too.
 */
export function plainFacts(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- the owner's words are one plain paragraph
      .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, OWNER_TEXT_LIMIT)
  );
}

/**
 * The facts as a sentence of their own: closed with a full stop when the owner
 * did not close it, so the next sentence never runs on. Left as typed when it
 * already ends in a stop, an ellipsis, a question or exclamation mark, or a
 * closing quote or bracket.
 */
export function asSentence(text: string): string {
  const plain = plainFacts(text);

  return plain === '' || /[.!?…»"”)]$/.test(plain) ? plain : `${plain}.`;
}

/** The facts as the end of somebody else's sentence (§ W bis.2 «Lo hemos revisado y {facts}.»): no closing stop of their own. */
export function asClause(text: string): string {
  return plainFacts(text).replace(/[.\s]+$/, '');
}
