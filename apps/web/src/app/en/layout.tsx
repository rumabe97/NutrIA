import { rootMetadata, siteViewport } from '../_shared/metadata';
import { RootShell } from '../_shared/RootShell';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = rootMetadata('en-GB');

export const viewport: Viewport = siteViewport;

/**
 * The English tree, served from `/en`. A real segment rather than a route group,
 * because a language a crawler cannot reach at its own address is a language no
 * one will ever find: this is the half that was previously invisible.
 *
 * `<html lang>` can only be set by a root layout, which is why this is one.
 */
export default function EnglishRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RootShell locale="en-GB">{children}</RootShell>;
}
