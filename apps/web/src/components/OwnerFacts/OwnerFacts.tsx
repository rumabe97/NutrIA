import { Fragment } from 'react';

import type { ReactNode } from 'react';
import type { WithFacts } from 'lib/ownerFacts';

/** Our words, with an authority's name the owner typed marked as Spanish where `{authority}` stands (on either side of the facts). */
function withAuthority(text: string, authority: string | undefined): ReactNode {
  if (authority === undefined || !text.includes('{authority}')) {
    return text;
  }

  const [head, ...tail] = text.split('{authority}');

  return (
    <Fragment>
      {head}
      <span lang="es">{authority}</span>
      {tail.join('{authority}')}
    </Fragment>
  );
}

/**
 * A sentence of ours around the facts the owner wrote (a statement of reasons):
 * our words in the page's language, the owner's in their own `<span lang="es">`.
 * The owner writes in Spanish, so on an English page the facts — and an
 * authority's name he typed — are marked as Spanish for a screen reader to
 * pronounce them as such (accessibility review, phase 8, WCAG 3.1.2).
 */
export function OwnerFacts({ value }: Readonly<{ value: WithFacts }>) {
  return (
    <Fragment>
      {withAuthority(value.before, value.authority)}
      {value.facts ? <span lang="es">{value.facts}</span> : null}
      {withAuthority(value.after, value.authority)}
    </Fragment>
  );
}
