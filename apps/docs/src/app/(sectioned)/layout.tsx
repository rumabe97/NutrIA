import styles from './layout.module.css';

import { Navigation } from 'components/Navigation';

import { buildWorkspaceNav } from 'lib/workspaceDocs';

import type { ReactNode } from 'react';

export default async function SectionedLayout({ children }: { children: ReactNode }) {
  // Dev-only: the /workspace docs sidebar is built from the repo's docs/ folder on the
  // server; in production this resolves to undefined and Navigation ignores it.
  const workspaceNav = await buildWorkspaceNav();

  return (
    <div className={styles.page}>
      <div aria-hidden="true" />
      <Navigation workspaceNav={workspaceNav} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
