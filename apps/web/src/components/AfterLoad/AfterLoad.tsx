'use client';
import { useEffect, useState } from 'react';

import type { ReactNode } from 'react';

/**
 * Holds its children back until the page has loaded, so nothing in them is fetched before.
 *
 * For a picture that is not the first thing a visitor looks at: a lazy `<img>` near the
 * first screen is still requested at once, and on a slow phone it takes the line from the
 * picture that is (measured on the landing page: the hero's picture arrived 1.6 s later for
 * the two under it). A hidden element has no box, so a lazy image inside it is not requested;
 * once the window's `load` has fired — the hero's picture, the fonts and the scripts are in —
 * the children are shown and load as any lazy picture does.
 *
 * The wrapper keeps `className` whether or not the children are shown, so the caller reserves
 * the room there and nothing moves when they arrive.
 */
export function AfterLoad({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (document.readyState === 'complete') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the page's state is only known after hydration.
      setLoaded(true);

      return;
    }

    const show = () => setLoaded(true);

    window.addEventListener('load', show, { once: true });

    return () => window.removeEventListener('load', show);
  }, []);

  return (
    <div className={className} data-after-load={loaded ? 'shown' : 'waiting'}>
      <div hidden={!loaded}>{children}</div>
    </div>
  );
}
