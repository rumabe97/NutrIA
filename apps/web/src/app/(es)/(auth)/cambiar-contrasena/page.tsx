import { ForcedPasswordScreen } from '../../../_shared/ForcedPasswordScreen';
import { pageMetadata } from '../../../_shared/metadata';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/cambiar-contrasena');

// Reads the session, like `/pendiente`, so it is rendered per request.
export const dynamic = 'force-dynamic';

export default function SpanishForcedPasswordPage() {
  return <ForcedPasswordScreen locale="es-ES" />;
}
