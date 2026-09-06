import styles from './Table.module.css';

import type { HTMLAttributes } from 'react';

export function Table(props: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className={styles.wrapper}>
      <table {...props} />
    </div>
  );
}
