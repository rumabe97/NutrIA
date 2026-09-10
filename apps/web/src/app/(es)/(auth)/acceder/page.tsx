import { pageMetadata } from '../../../_shared/metadata';
import { SignInScreen } from '../../../_shared/SignInScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/acceder');

export default function SpanishSignInPage() {
  return <SignInScreen locale="es-ES" />;
}
