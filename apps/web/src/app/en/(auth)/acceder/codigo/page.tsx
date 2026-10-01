import { pageMetadata } from '../../../../_shared/metadata';
import { TwoFactorScreen } from '../../../../_shared/TwoFactorScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/acceder/codigo');

export default function EnglishTwoFactorPage() {
  return <TwoFactorScreen locale="en-GB" />;
}
