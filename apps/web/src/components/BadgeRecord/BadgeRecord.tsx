import { useId } from 'react';

import styles from './BadgeRecord.module.css';

import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { OwnerFacts } from 'components/OwnerFacts';

import { checkReason } from 'lib/ownerStatements';
import { formatInstant, interpolate } from 'lib/format';

import type { BadgeCheckView } from 'core/controllers/Professional';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';

interface BadgeRecordProps {
  checks: readonly BadgeCheckView[];
  dictionary: Dictionary;
  locale: Locale;
}

/**
 * Every step ever written on one practitioner's badge, newest first (PRD 025
 * criterion 3: the record is the checker, the date, the register, the result, the
 * number and the channel). A request, a badge given, a refusal, a withdrawal, a lapse:
 * each in its own words, its date, how the code went, the college and the number —
 * declared for a request, checked for a badge — and the reason, as the statement said
 * it, with the owner's own facts marked with their language. Never who checked: that
 * is the owner's own id and no view carries it.
 */
export function BadgeRecord({ checks, dictionary, locale }: BadgeRecordProps) {
  const headingId = useId();
  const t = dictionary.adminBadge;
  const record = t.record;
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Card aria-labelledby={headingId} as="section" className={styles.card}>
      <h2 className={styles.title} id={headingId}>
        {record.title}
      </h2>
      {checks.length === 0 ? (
        <Text tone="secondary">{record.empty}</Text>
      ) : (
        <ol className={styles.list} role="list">
          {checks.map(check => {
            const reason = checkReason(dictionary, check, day);
            const number = check.number
              ? interpolate(check.kind === 'applied' ? record.numberDeclared : check.kind === 'pass' ? record.numberChecked : record.number, {
                  number: check.number
                })
              : null;
            const lines = [
              check.channel ? interpolate(record.channel, { channel: t.channelWords[check.channel] }) : null,
              check.register ? interpolate(record.register, { register: check.register }) : null,
              number,
              check.dueAt && check.kind === 'pass' ? interpolate(record.renewal, { date: day(check.dueAt) }) : null
            ].filter((line): line is string => line !== null);

            return (
              <li className={styles.entry} key={`${check.kind}-${check.checkedAt}`}>
                <p className={styles.head}>
                  <span className={styles.kind}>{record.kinds[check.kind]}</span>
                  <time className={styles.when} dateTime={check.checkedAt}>
                    {day(check.checkedAt)}
                  </time>
                </p>
                {lines.length > 0 ? <p className={styles.lines}>{lines.join(' · ')}</p> : null}
                {reason ? (
                  <p className={styles.reason}>
                    <OwnerFacts value={reason} />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
