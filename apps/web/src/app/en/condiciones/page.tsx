import { LegalScreen } from '../../_shared/LegalScreen';
import { pageMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/condiciones');

export default function EnglishTermsPage() {
  return <LegalScreen document="terms" locale="en-GB" />;
}
