import styles from './SummaryRow.module.css';

import { Text } from 'ui/components/Text';

interface SummaryRowProps {
  label: string;
  value?: string | null;
}

/** A label/value line. An em dash stands in for anything not filled in yet. */
export function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className={styles.row}>
      <Text size="sm" tone="tertiary">
        {label}
      </Text>
      <Text size="sm">{value || '—'}</Text>
    </div>
  );
}
