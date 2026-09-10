import { AuthShell } from '../../_shared/AuthShell';

import type { ReactNode } from 'react';

export default function SpanishAuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthShell locale="es-ES">{children}</AuthShell>;
}
