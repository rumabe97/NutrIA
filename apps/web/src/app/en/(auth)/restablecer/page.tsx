import { pageMetadata } from '../../../_shared/metadata';
import { ResetScreen } from '../../../_shared/ResetScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/restablecer');

export default function EnglishResetPage() {
  return <ResetScreen locale="en-GB" />;
}
