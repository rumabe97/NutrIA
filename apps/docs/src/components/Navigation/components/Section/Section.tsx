import styles from './Section.module.css';

import type { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  title: string;
}

export function Section({ children, title }: SectionProps) {
  return (
    <div>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </div>
  );
}
