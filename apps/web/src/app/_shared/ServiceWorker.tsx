'use client';
import { useEffect } from 'react';

import { registerServiceWorker } from 'lib/offline';

/**
 * Installs the worker that keeps today's screen and the shopping list for
 * reading offline (`0053`). From every root, not only the signed-in one, so it
 * is already running when the first signed-in screen opens and that screen is
 * stored from the first visit.
 */
export function ServiceWorker() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return null;
}
