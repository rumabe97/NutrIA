'use client';
import { useEffect, useRef } from 'react';

import { usePathname } from 'next/navigation';

import { MAIN_ID } from './mainId';

/**
 * Says out loud that the screen changed.
 *
 * A full page load moves focus back to the document, and a screen reader reads
 * the new title. A client-side navigation does neither: React swaps the
 * contents of `<main>` and focus stays wherever the link that was clicked used
 * to be — often on a node that no longer exists. Somebody using a screen reader
 * hears silence and has to go looking for what happened.
 *
 * So focus moves to the new page's `<h1>`, which announces the heading and puts
 * the keyboard at the top of the content rather than back at the start of the
 * navigation. `tabindex="-1"` makes a heading focusable by script without
 * putting it in the tab order. Not the first render: nothing changed then, and
 * stealing focus on arrival would fight the browser's own restoration.
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const changed = previous.current !== null && previous.current !== pathname;

    previous.current = pathname;

    if (!changed) {
      return;
    }

    const main = document.getElementById(MAIN_ID);
    // The heading when there is one, the region itself when there is not, so a
    // screen that has yet to grow an `<h1>` still announces something.
    const target = main?.querySelector('h1') ?? main;

    if (!target) {
      return;
    }

    target.setAttribute('tabindex', '-1');
    // Next has already restored the scroll position by now; focusing without
    // this would yank the page a second time.
    target.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
