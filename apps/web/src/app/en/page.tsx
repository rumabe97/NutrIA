import { Landing } from '../_shared/Landing';
import { pageMetadata } from '../_shared/metadata';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/');

export default function EnglishLandingPage() {
  return <Landing locale="en-GB" />;
}
