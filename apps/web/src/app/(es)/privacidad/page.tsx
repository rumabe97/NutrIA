import { LegalScreen } from '../../_shared/LegalScreen';
import { pageMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/privacidad');

export default function SpanishPrivacyPage() {
  return <LegalScreen document="privacy" locale="es-ES" />;
}
