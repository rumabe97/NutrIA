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
 * Said once, so the label and the name the navigation announces are the same
 * words. A constant rather than a `useId` because this is a server component —
 * which is safe only while **one switch renders per page**, as `/compra` and
 * `/compra/proxima` each do. A second one on the same screen would collide here
 * and misname its own navigation.
 */
const LABEL_ID = 'plan-switch-label';

/**
 * Two plans, one screen's worth each: a pair of links, not a tab list, because
 * each side is its own address and the back button is the way between them.
 *
 * The label is visible, where it used to be an `aria-label` nobody could see.
 * On `/compra` this sits twelve pixels above the range control wearing the same
 * pill recipe, and "Actual / Próximo" reads as another span of days unless
 * something says which question each row is answering. Both rows now say it.
 */
export function PlanSwitch({ hrefs, labels, on }: PlanSwitchProps) {
  return (
    <div className={styles.root}>
      <span className={styles.legend} id={LABEL_ID}>
        {labels.legend}
      </span>
      <nav aria-labelledby={LABEL_ID} className={styles.switch}>
        <Link aria-current={on === 'current' ? 'page' : undefined} className={styles.link} href={hrefs.current}>
          {labels.current}
        </Link>
        <Link aria-current={on === 'next' ? 'page' : undefined} className={styles.link} href={hrefs.next}>
          {labels.next}
        </Link>
      </nav>
    </div>
  );
}
