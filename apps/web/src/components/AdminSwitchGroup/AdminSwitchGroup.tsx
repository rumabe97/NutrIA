import { useId } from 'react';

import styles from './AdminSwitchGroup.module.css';

import { Card } from 'components/Card';

import type { ReactNode } from 'react';

interface AdminSwitchGroupProps {
  /** The group's rows: `<li>`s, one switch (or one action) each. */
  children: ReactNode;
  /** The group's name — in small capitals over its rows, and the name of its landmark. */
  title: string;
}

/**
 * A group of the console's switches on one card, as the sheet draws it: the group's name in
 * small capitals inside the card, then its rows with a hairline between them. The name is a
 * heading, so the page's outline and the landmarks menu still list it.
 */
export function AdminSwitchGroup({ children, title }: AdminSwitchGroupProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.group}>
      <Card>
        <h2 className={styles.title} id={headingId}>
          {title}
        </h2>
        <ul className={styles.rows}>{children}</ul>
      </Card>
    </section>
  );
}
