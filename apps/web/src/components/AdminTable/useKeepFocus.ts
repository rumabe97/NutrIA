'use client';
import { useCallback, useEffect, useRef } from 'react';

import { focusIsLost, focusTableStatus } from './tableStatus';

import type { RefObject } from 'react';

/**
 * Keeps focus on a row action through its request (`0068`).
 *
 * `Button loading` disables the button, and a disabled button drops focus to the page;
 * an action can also take its own button away. So: hand the button to the returned
 * function as it is pressed, and once `pending` is false again focus goes back to it —
 * or, when it is gone, to the first button left in `row`, and failing that to the
 * table's status line. Nothing moves when focus is already somewhere else: the person
 * moved on.
 */
export function useKeepFocus(pending: boolean, row?: RefObject<HTMLElement | null>): (pressed: HTMLElement | null) => void {
  const pressed = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = pressed.current;

    if (pending || !element) {
      return;
    }

    pressed.current = null;

    if (!focusIsLost()) {
      return;
    }

    if (element.isConnected && !element.matches(':disabled')) {
      element.focus();

      return;
    }

    const next = row?.current?.querySelector<HTMLElement>('button:not(:disabled)');

    if (next) {
      next.focus();
    } else {
      focusTableStatus();
    }
  }, [pending, row]);

  return useCallback((element: HTMLElement | null) => {
    pressed.current = element;
  }, []);
}
