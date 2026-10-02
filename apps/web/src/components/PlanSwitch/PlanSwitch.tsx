import Link from 'next/link';

import styles from './PlanSwitch.module.css';

interface PlanSwitchProps {
  /** Where each side goes: the plan under way and the one that has not started. */
  hrefs: { current: string; next: string };
  labels: { current: string; legend: string; next: string };
  /** Which of the two this screen is. */
  on: 'current' | 'next';
}

/**
 * Two plans, one screen's worth each: a pair of links, not a tab list, because
 * each side is its own address and the back button is the way between them.
 */
export function PlanSwitch({ hrefs, labels, on }: PlanSwitchProps) {
  return (
    <nav aria-label={labels.legend} className={styles.switch}>
      <Link aria-current={on === 'current' ? 'page' : undefined} className={styles.link} href={hrefs.current}>
        {labels.current}
      </Link>
      <Link aria-current={on === 'next' ? 'page' : undefined} className={styles.link} href={hrefs.next}>
        {labels.next}
      </Link>
    </nav>
  );
}
