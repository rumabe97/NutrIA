'use client';
import { useRef } from 'react';

import { useCommand } from '../useCommand';
import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect';
import { VALUE_ATTR } from '../../constants';

import type { ReactNode, RefObject } from 'react';

/**
 * Computes the item's searchable text from `value` / `children` / `textContent` (in that order),
 * registers it with the command context, and stamps `data-value` on the DOM element via `ref`.
 * Returns the ref containing the resolved value so callers can read it imperatively (used by item
 * select handlers, which must avoid re-creating on every render).
 */
export function useValue(
  id: string,
  ref: RefObject<HTMLElement | null>,
  deps: ReadonlyArray<ReactNode | RefObject<HTMLElement | null> | string>,
  aliases: ReadonlyArray<string> = []
): RefObject<string | undefined> {
  const valueRef = useRef<string | undefined>(undefined);
  const context = useCommand();

  useIsomorphicLayoutEffect(() => {
    const resolved = (() => {
      for (const part of deps) {
        if (typeof part === 'string') {
          return part.trim();
        }

        if (part && typeof part === 'object' && 'current' in part) {
          if (part.current) {
            return part.current.textContent?.trim();
          }

          return valueRef.current;
        }
      }
    })();

    if (resolved === undefined) {
      return;
    }

    const keywords = aliases.map(alias => alias.trim());
    context.value(id, resolved, keywords);
    ref.current?.setAttribute(VALUE_ATTR, resolved);
    valueRef.current = resolved;
  });

  return valueRef;
}
