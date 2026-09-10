import { AuthShell } from '../../_shared/AuthShell';

import type { ReactNode } from 'react';

export default function EnglishAuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthShell locale="en-GB">{children}</AuthShell>;
}
