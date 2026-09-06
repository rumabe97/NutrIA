'use client';
import { useContext, useEffect, useId, useRef } from 'react';

import { composeRefs } from 'ui/utils/composeRefs';

import { GroupContext } from '../../context';
import { SELECT_EVENT } from '../../constants';
import { useAsRef } from '../../hooks/useAsRef';
import { useCommand } from '../../hooks/useCommand';
import { useIsomorphicLayoutEffect } from '../../hooks/useIsomorphicLayoutEffect';
import { useSpotlight } from '../../hooks/useSpotlight';
import { useStore } from '../../hooks/useStore';
import { useValue } from '../../hooks/useValue';

import type { ItemProps } from '../../types';

/**
 * Command menu item. Active on pointer enter or via keyboard navigation. Pass a stable `value`
 * when `children` may change between renders; otherwise the value is inferred from the rendered
 * `textContent`.
 */
export function SpotlightItem(props: ItemProps) {
  const id = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  const groupContext = useContext(GroupContext);
  const context = useCommand();
  const propsRef = useAsRef(props);
  const forceMount = propsRef.current?.forceMount ?? groupContext?.forceMount;

  useIsomorphicLayoutEffect(() => {
    if (!forceMount) {
      return context.item(id, groupContext?.id);
    }

    return undefined;
  }, [forceMount]);

  const value = useValue(id, ref, [props.value, props.children, ref], props.keywords);

  const store = useStore();
  const selected = useSpotlight(state => state.value !== '' && state.value === value.current);
  const render = useSpotlight(state =>
    forceMount ? true : context.filter() === false ? true : !state.search ? true : (state.filtered.items.get(id) ?? 0) > 0
  );

  useEffect(() => {
    const element = ref.current;

    if (!element || props.disabled) {
      return undefined;
    }

    element.addEventListener(SELECT_EVENT, onSelect);

    return () => element.removeEventListener(SELECT_EVENT, onSelect);
    // onSelect is captured via propsRef; including it would re-bind on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, props.disabled]);

  function onSelect(): void {
    select();
    propsRef.current.onSelect?.(value.current ?? '');
  }

  function select(): void {
    store.setState('value', value.current ?? '', true);
  }

  if (!render) {
    return null;
  }

  const { disabled, forceMount: _forceMount, keywords: _keywords, onSelect: _onSelect, ref: forwardedRef, value: _v, ...etc } = props;

  return (
    <div
      ref={composeRefs(ref, forwardedRef)}
      {...etc}
      aria-disabled={Boolean(disabled)}
      aria-selected={Boolean(selected)}
      data-disabled={Boolean(disabled)}
      data-selected={Boolean(selected)}
      data-spotlight-item=""
      id={id}
      onClick={disabled ? undefined : onSelect}
      onPointerMove={disabled || context.getDisablePointerSelection() ? undefined : select}
      role="option"
    >
      {props.children}
    </div>
  );
}
