import { LegalScreen } from '../../_shared/LegalScreen';
import { pageMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/condiciones');

export default function SpanishTermsPage() {
  return <LegalScreen document="terms" locale="es-ES" />;
}
