import { pageMetadata } from '../../../_shared/metadata';
import { ResetScreen } from '../../../_shared/ResetScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/restablecer');

export default function SpanishResetPage() {
  return <ResetScreen locale="es-ES" />;
}
