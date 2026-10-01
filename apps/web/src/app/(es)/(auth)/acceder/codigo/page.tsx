import { pageMetadata } from '../../../../_shared/metadata';
import { TwoFactorScreen } from '../../../../_shared/TwoFactorScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/acceder/codigo');

export default function SpanishTwoFactorPage() {
  return <TwoFactorScreen locale="es-ES" />;
}
