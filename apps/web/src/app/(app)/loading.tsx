import styles from './loading.module.css';

import { Skeleton } from 'ui/components/Skeleton';

/**
 * Shown while any signed-in route resolves.
 *
 * Every page in this group is `force-dynamic` — it fetches the user's own data on
 * each request — and Next.js holds the *previous* screen until the response lands
 * unless a `loading.tsx` exists. Without this file, navigating looked like the app
 * had frozen, which is exactly how it was reported.
 *
 * The shape mirrors the dashboard and plan screens rather than being a spinner, so
 * the page does not visibly jump when the real content replaces it.
 */
export default function AppLoading() {
  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <Skeleton animation="wave" height="2.25rem" width="14rem" />
        <Skeleton height="1rem" width="22rem" />
      </div>

      <div className={styles.card}>
        <Skeleton height="1.25rem" width="8rem" />

        <div className={styles.stats}>
          {[0, 1, 2, 3].map(index => (
            <Skeleton height="3rem" key={index} />
          ))}
        </div>

        {[0, 1, 2, 3].map(index => (
          <div className={styles.row} key={index}>
            <Skeleton height="0.875rem" />
            <Skeleton height="1.125rem" />
            <Skeleton height="0.875rem" />
          </div>
        ))}
      </div>
    </div>
  );
}
