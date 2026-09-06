'use client';
import { useId, useMemo, useRef } from 'react';

import { composeRefs } from 'ui/utils/composeRefs';

import { GroupContext } from '../../context';
import { slottableWithNestedChildren } from '../../utils/slottableWithNestedChildren';
import { useCommand } from '../../hooks/useCommand';
import { useIsomorphicLayoutEffect } from '../../hooks/useIsomorphicLayoutEffect';
import { useSpotlight } from '../../hooks/useSpotlight';
import { useValue } from '../../hooks/useValue';

import type { GroupProps } from '../../types';

/**
 * Groups command-menu items together with a heading. Items inside a group stay together when
 * sorted by score.
 */
export function SpotlightGroup(props: GroupProps) {
  const { forceMount, heading, ref: forwardedRef, ...etc } = props;
  const id = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();
  const context = useCommand();
  const render = useSpotlight(state =>
    forceMount ? true : context.filter() === false ? true : !state.search ? true : state.filtered.groups.has(id)
  );

  useIsomorphicLayoutEffect(() => {
    return context.group(id);
  }, [id]);

  useValue(id, ref, [props.value, props.heading, headingRef]);

  const contextValue = useMemo(() => ({ id, forceMount }), [id, forceMount]);

  return (
    <div ref={composeRefs(ref, forwardedRef)} {...etc} data-spotlight-group="" hidden={render ? undefined : true} role="presentation">
      {heading ? (
        <div aria-hidden={true} data-spotlight-group-heading="" id={headingId} ref={headingRef}>
          {heading}
        </div>
      ) : null}
      {slottableWithNestedChildren(etc, child => (
        <div aria-labelledby={heading ? headingId : undefined} data-spotlight-group-items="" role="group">
          <GroupContext.Provider value={contextValue}>{child}</GroupContext.Provider>
        </div>
      ))}
    </div>
  );
}
