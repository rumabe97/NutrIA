'use client';
import { useEffect } from 'react';

import { takeFocusAfterRefresh } from 'lib/focusAfterRefresh';

import type { FocusHandOver } from 'lib/focusAfterRefresh';

interface FocusOnArrivalProps {
  /** The element to focus: a heading with `tabIndex={-1}`. */
  targetId: string;
  /** The hand-over that brings focus here (`lib/focusAfterRefresh`). */
  what: FocusHandOver;
}

/**
 * Focus for a server-rendered view that replaces another at the same address
 * (`lib/focusAfterRefresh`): draws nothing, and on arrival moves focus to its
 * target only when the hand-over named it.
 */
export function FocusOnArrival({ targetId, what }: FocusOnArrivalProps) {
  useEffect(() => {
    if (takeFocusAfterRefresh(what)) {
      document.getElementById(targetId)?.focus();
    }
  }, [targetId, what]);

  return null;
}
