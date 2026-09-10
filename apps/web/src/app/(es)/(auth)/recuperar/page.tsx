import { pageMetadata } from '../../../_shared/metadata';
import { RecoverScreen } from '../../../_shared/RecoverScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('es-ES', '/recuperar');

export default function SpanishRecoverPage() {
  return <RecoverScreen />;
}
