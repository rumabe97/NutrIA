import { pageMetadata } from '../../../_shared/metadata';
import { SignInScreen } from '../../../_shared/SignInScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/acceder');

export default function EnglishSignInPage() {
  return <SignInScreen locale="en-GB" />;
}
