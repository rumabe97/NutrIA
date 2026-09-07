'use client';
import Link from 'next/link';

import styles from './ProfileSection.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { SummaryRow } from 'components/SummaryRow';

interface ProfileSectionProps {
  /** Where the edit link goes — the onboarding step that owns these fields. */
  editHref: string;
  rows: readonly { label: string; value?: string | null }[];
  title: string;
}

/**
 * A read-only block with one edit entry point, pointing back at the onboarding
 * step that owns those fields.
 *
 * Deliberately not a second set of edit forms: two places to change the same
 * data means two sets of validation to keep in agreement, and the onboarding
 * steps already validate every field against the shared schemas.
 */
export function ProfileSection({ editHref, rows, title }: ProfileSectionProps) {
  const dictionary = useDictionary();

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <Text weight="semibold">{title}</Text>
        <Link className={styles.editLink} href={editHref}>
          {dictionary.common.edit}
        </Link>
      </div>
      <div className={styles.rows}>
        {rows.map(row => (
          <SummaryRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
}
