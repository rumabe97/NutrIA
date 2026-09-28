import styles from './SortIcon.module.css';

interface SortIconProps {
  /** Which way the column is sorted; `undefined` for a sortable column that is not. */
  sorted: 'asc' | 'desc' | undefined;
}

const PATHS = { asc: 'M4 10l4-4 4 4', desc: 'M4 6l4 4 4-4', idle: 'M5 6.5l3-3 3 3M5 9.5l3 3 3-3' } as const;

/**
 * The arrow beside a sortable header: which way it is sorted, or both ways, fainter,
 * when it is not — the mark that says the header is a control. `aria-sort` on the
 * header says the same to a screen reader, so this is decorative.
 */
export function SortIcon({ sorted }: SortIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={sorted ? styles.icon : `${styles.icon} ${styles.idle}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
    >
      <path d={PATHS[sorted ?? 'idle']} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
