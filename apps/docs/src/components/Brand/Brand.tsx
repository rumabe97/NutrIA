import styles from './Brand.module.css';

import { Link } from 'ui/components/Link';

interface BrandProps {
  className?: string;
}

export function Brand({ className }: BrandProps) {
  return (
    <Link aria-label="Home — mini template" className={className ? `${styles.brand} ${className}` : styles.brand} href="/">
      <span aria-hidden="true" className={styles.mark} />
      <span className={styles.brandText}>mini</span>
    </Link>
  );
}
