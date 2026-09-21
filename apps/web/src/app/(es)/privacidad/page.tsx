import { pageMetadata } from '../../_shared/metadata';
import { PrivacyScreen } from '../../_shared/PrivacyScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/privacidad');

export default function SpanishPrivacyPage() {
  return <PrivacyScreen locale="es-ES" />;
}
