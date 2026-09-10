import { pageMetadata } from '../../../_shared/metadata';
import { RecoverScreen } from '../../../_shared/RecoverScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/recuperar');

export default function EnglishRecoverPage() {
  return <RecoverScreen />;
}
