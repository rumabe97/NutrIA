import { pageMetadata } from '../../../_shared/metadata';
import { VerifyEmailScreen } from '../../../_shared/VerifyEmailScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/verificar-email');

export default function EnglishVerifyEmailPage() {
  return <VerifyEmailScreen locale="en-GB" />;
}
