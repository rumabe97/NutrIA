'use client';
import { useLayoutEffect } from 'react';

import { dishArrived } from 'lib/dishTransition';

/**
 * Rendered by a dish's page: says it has mounted, so a card's View Transition into it
 * (`lib/dishTransition`) draws this page rather than the loading screen before it.
 * Before paint, so the transition's new state is the page itself. Draws nothing.
 */
export function DishArrival() {
  useLayoutEffect(() => {
    dishArrived();
  }, []);

  return null;
}
