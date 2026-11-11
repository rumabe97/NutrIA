'use client';
import { useRef } from 'react';

import { useComposedRefs } from 'ui/hooks/useComposedRefs';
import { useInView } from 'ui/hooks/useInView';

import type { ComponentPropsWithRef } from 'react';

export interface InViewProps extends ComponentPropsWithRef<'div'> {
  /** The element drawn: a `div` by default, `span` inside a line of text. */
  as?: 'div' | 'figure' | 'span';
}

/**
 * Holds the entrances inside it until it is reached (`ui/hooks/useInView`): a chart or a ring
 * below the fold draws itself when somebody scrolls to it, once, instead of unseen on load.
 *
 * It adds no style and no role: a wrapper, so a server component (a chart, `Rings`) can keep
 * rendering on the server and hand only this one leaf to the client.
 */
export function InView({ as: Component = 'div', ref, ...rest }: InViewProps) {
  const own = useRef<HTMLDivElement>(null);
  const composed = useComposedRefs(own, ref);

  useInView(own);

  return <Component ref={composed} {...rest} />;
}
