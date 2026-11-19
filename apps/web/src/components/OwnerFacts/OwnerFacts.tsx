import { Fragment } from 'react';

import type { WithFacts } from 'lib/ownerFacts';

/**
 * A sentence of ours around the facts the owner wrote (a statement of reasons):
 * our words in the page's language, the owner's in their own `<span lang="es">`.
 * The owner writes in Spanish, so on an English page the facts are marked as
 * Spanish for a screen reader to pronounce them as such (accessibility review,
 * phase 8, WCAG 3.1.2).
 */
export function OwnerFacts({ value }: Readonly<{ value: WithFacts }>) {
  return (
    <Fragment>
      {value.before}
      {value.facts ? <span lang="es">{value.facts}</span> : null}
      {value.after}
    </Fragment>
  );
}
