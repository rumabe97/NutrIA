import { pageMetadata } from '../../../_shared/metadata';
import { PendingScreen } from '../../../_shared/PendingScreen';

import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata('en-GB', '/pendiente');

export const dynamic = 'force-dynamic';

export default function EnglishPendingPage() {
  return <PendingScreen locale="en-GB" />;
}
