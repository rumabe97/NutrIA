'use client';
import { useSearchParams } from 'next/navigation';

import { EmailConfirmed } from './EmailConfirmed';

/** Reads `?error` — hence a client component behind Suspense, whose fallback is the confirmed page. */
export function EmailConfirmedFromLink() {
  return <EmailConfirmed refused={useSearchParams().has('error')} />;
}
