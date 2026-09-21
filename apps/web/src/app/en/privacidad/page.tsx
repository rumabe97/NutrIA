import { pageMetadata } from '../../_shared/metadata';
import { PrivacyScreen } from '../../_shared/PrivacyScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/privacidad');

export default function EnglishPrivacyPage() {
  return <PrivacyScreen locale="en-GB" />;
}
