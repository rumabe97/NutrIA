import { rootMetadata, siteViewport } from '../_shared/metadata';
import { RootShell } from '../_shared/RootShell';
import { SiteJsonLd } from '../_shared/SiteJsonLd';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = rootMetadata('es-ES');

export const viewport: Viewport = siteViewport;

/**
 * The Spanish tree, and the URLs the product already has: `/`, `/registro`,
 * `/acceder`. It is a route group, so the folder never reaches the address bar —
 * the default language is the one without a prefix, and every link anybody has
 * saved keeps working.
 *
 * The locale is written here rather than read from a cookie or an
 * `Accept-Language` header, which is what lets every page below be built once
 * and served from the edge instead of rendered per visitor.
 */
export default function SpanishRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <RootShell locale="es-ES">
      <SiteJsonLd locale="es-ES" />
      {children}
    </RootShell>
  );
}
