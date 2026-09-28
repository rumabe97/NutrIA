import { useId } from 'react';

import styles from './AdminSection.module.css';

import { Text } from 'ui/components/Text';

import type { ReactNode } from 'react';

interface AdminSectionProps {
  children: ReactNode;
  /** A short line under the heading — what the section counts over, when that is not the period. */
  note?: string;
  title: string;
}

/**
 * One region of a console page: a heading that names it for the outline and the
 * landmarks menu, an optional note, and its content.
 */
export function AdminSection({ children, note, title }: AdminSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <div className={styles.heading}>
        <h2 className={styles.title} id={headingId}>
          {title}
        </h2>
        {note ? (
          <Text className={styles.note} size="sm" tone="secondary">
            {note}
          </Text>
        ) : null}
      </div>
      {children}
    </section>
  );
}
