'use client';
import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { syncLocaleFromProfile } from 'lib/locale-sync';
import { takeArrival } from 'lib/arrival';

/**
 * The after-sign-in step, for somebody who came back from a provider (`0058`).
 *
 * The password form reconciles the browser's language with the account's
 * before it navigates, because it is still there when the session starts. A
 * tab that left for Google lands straight on a signed-in screen, so the app
 * shell does it instead — once, and only for a tab that left a note saying it
 * was on its way (`lib/arrival`). Renders nothing.
 */
export function ArrivalSync() {
  const router = useRouter();

  useEffect(() => {
    if (!takeArrival()) {
      return;
    }

    // The cookie may have just changed, and this screen was rendered before it did.
    void syncLocaleFromProfile().then(() => router.refresh());
  }, [router]);

  return null;
}
