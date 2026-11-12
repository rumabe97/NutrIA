'use client';
import Link from 'next/link';

import styles from './ProfileSection.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

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
    <section className={styles.section}>
      {/* As the approved sheet draws a group of answers: its name and the way to change
          it on one line, then the answers as rows on one sunken ground — a name at the
          line's start, what was answered at its end. */}
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        <Link className={styles.editLink} href={editHref}>
          {dictionary.common.edit}
        </Link>
      </div>
      <dl className={styles.rows}>
        {rows.map(row => (
          <div className={styles.row} key={row.label}>
            <dt className={styles.label}>{row.label}</dt>
            {/* An em dash stands in for anything not filled in yet. */}
            <dd className={styles.value}>{row.value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
