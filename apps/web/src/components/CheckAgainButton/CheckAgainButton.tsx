'use client';
import { useEffect, useState } from 'react';

import { Button } from 'ui/components/Button';

import type { ReactNode } from 'react';

/**
 * "Check again" on the pending page is a full document load, not a client-side
 * navigation. Through the router, `/inicio` answered with a redirect back to the
 * page the person was already on, and the router was left showing the route's
 * loading skeleton until they reloaded by hand — including after the account
 * had been activated. A real navigation asks the server afresh and lands
 * wherever the account now belongs.
 */
export function CheckAgainButton({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(false);

  // Coming back through the browser's history can restore this page from the
  // back-forward cache, spinner and all. Restored means nothing is in flight.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) {setChecking(false);}
    };

    window.addEventListener('pageshow', reset);

    return () => window.removeEventListener('pageshow', reset);
  }, []);

  function handle() {
    setChecking(true);
    window.location.assign('/inicio');
  }

  return (
    <Button loading={checking} onClick={handle} type="button" variant="secondary">
      {children}
    </Button>
  );
}
