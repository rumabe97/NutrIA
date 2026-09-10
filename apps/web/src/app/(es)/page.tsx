import { Landing } from '../_shared/Landing';
import { pageMetadata } from '../_shared/metadata';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/');

export default function SpanishLandingPage() {
  return <Landing locale="es-ES" />;
}
