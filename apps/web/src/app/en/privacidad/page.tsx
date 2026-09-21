import { LegalScreen } from '../../_shared/LegalScreen';
import { pageMetadata } from '../../_shared/metadata';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/privacidad');

export default function EnglishPrivacyPage() {
  return <LegalScreen document="privacy" locale="en-GB" />;
}
