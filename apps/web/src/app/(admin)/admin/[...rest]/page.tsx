import { notFound } from 'next/navigation';

import { getDictionary } from 'i18n/server';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).errors.notFoundTitle };
}

/**
 * Any console address that is not a page (`0028`). Without this, `/admin/zzz` got
 * Next's bare 404 — its own title, its own words — while a real page shown to a
 * stranger got the console's, so the two told a real address from a made-up one.
 * Now both are `(admin)/not-found.tsx` under the same title, whoever asks.
 */
export default function AdminUnknownPage(): never {
  notFound();
}
