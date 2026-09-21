import { signInProviders } from 'lib/sign-in-providers';

import { pageMetadata } from '../../../_shared/metadata';
import { RegisterScreen } from '../../../_shared/RegisterScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/registro');

export default async function EnglishRegisterPage() {
  return <RegisterScreen providers={await signInProviders()} />;
}
