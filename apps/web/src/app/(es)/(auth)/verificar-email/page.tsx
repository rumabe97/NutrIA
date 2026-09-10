import { pageMetadata } from '../../../_shared/metadata';
import { VerifyEmailScreen } from '../../../_shared/VerifyEmailScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/verificar-email');

export default function SpanishVerifyEmailPage() {
  return <VerifyEmailScreen locale="es-ES" />;
}
