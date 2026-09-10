import styles from './AuthLoading.module.css';

import { Skeleton } from 'ui/components/Skeleton';

export function AuthLoading() {
  return (
    <div className={styles.header}>
      <Skeleton animation="wave" height="2rem" width="min(12rem, 100%)" />
      <Skeleton height="1rem" width="min(16rem, 100%)" />
      <Skeleton height="2.5rem" />
      <Skeleton height="2.5rem" />
    </div>
  );
}
