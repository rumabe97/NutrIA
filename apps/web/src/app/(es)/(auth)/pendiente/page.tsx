import { pageMetadata } from '../../../_shared/metadata';
import { PendingScreen } from '../../../_shared/PendingScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/pendiente');

export const dynamic = 'force-dynamic';

export default function SpanishPendingPage() {
  return <PendingScreen locale="es-ES" />;
}
