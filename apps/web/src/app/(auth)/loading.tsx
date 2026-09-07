import styles from './loading.module.css';

import { Skeleton } from 'ui/components/Skeleton';

export default function AuthLoading() {
  return (
    <div className={styles.header}>
      <Skeleton animation="wave" height="2rem" width="12rem" />
      <Skeleton height="1rem" width="16rem" />
      <Skeleton height="2.5rem" />
      <Skeleton height="2.5rem" />
    </div>
  );
}
