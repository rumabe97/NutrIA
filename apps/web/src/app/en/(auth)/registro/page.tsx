import { pageMetadata } from '../../../_shared/metadata';
import { RegisterScreen } from '../../../_shared/RegisterScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/registro');

export default function EnglishRegisterPage() {
  return <RegisterScreen />;
}
