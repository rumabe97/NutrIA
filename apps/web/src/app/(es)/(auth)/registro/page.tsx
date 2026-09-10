import { pageMetadata } from '../../../_shared/metadata';
import { RegisterScreen } from '../../../_shared/RegisterScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/registro');

export default function SpanishRegisterPage() {
  return <RegisterScreen />;
}
