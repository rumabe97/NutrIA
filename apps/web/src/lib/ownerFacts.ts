import { interpolate } from './format';

/**
 * A sentence of ours with the owner's own facts inside it, kept apart so the
 * facts can be marked with their language (`components/OwnerFacts`): the words
 * before them, the facts, and the words after. The owner writes in Spanish.
 */
export interface WithFacts {
  after: string;
  /**
   * The name of an authority the owner typed (§ W bis.1 «Nos lo exige {authority}.»), in
   * Spanish too: `after` keeps `{authority}` where it goes, for the page to mark it.
   */
  authority?: string;
  before: string;
  facts: string | null;
}

/**
 * Fill `template` with `values`, and split it at `{facts}` — the one placeholder
 * that carries the owner's words — so they never reach a translated string.
 * Without facts, the placeholder and the space before it go.
 */
export function aroundFacts(template: string, values: Readonly<Record<string, number | string>>, facts: string | null): WithFacts {
  const filled = interpolate(template, values);
  const at = filled.indexOf('{facts}');

  if (at < 0) {
    return { after: '', before: filled, facts: null };
  }

  const before = filled.slice(0, at);
  const after = filled.slice(at + '{facts}'.length);

  return facts ? { after, before, facts } : { after: after.trimStart(), before: before.trimEnd() + (after.trimStart() ? ' ' : ''), facts: null };
}

/** The whole sentence as text, facts included: for tests and for keys. */
export function plainText(value: WithFacts): string {
  const named = (text: string) => (value.authority === undefined ? text : text.replace('{authority}', value.authority));

  return `${named(value.before)}${value.facts ?? ''}${named(value.after)}`;
}
