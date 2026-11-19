import styles from './RestrictionStanding.module.css';

import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { OwnerFacts } from 'components/OwnerFacts';

import { formatInstant, interpolate } from 'lib/format';
import { restrictionStatement } from 'lib/ownerStatements';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';
import type { PracticeRestrictionView } from 'core/controllers/Professional';

interface RestrictionStandingProps {
  dictionary: Dictionary;
  locale: Locale;
  restriction: PracticeRestrictionView | null;
}

/**
 * What stands against a practice and what it was decided for (PRD 025 scope 16): the
 * suspension, and the close with its day — or its closing, when the sweep has carried
 * it out — each with the statement as the person read it: the owner's facts, the
 * section of the agreement, where the decision came from. A restriction decided before
 * its statement was kept says so, plainly. Never who decided it: no view carries that.
 */
export function RestrictionStanding({ dictionary, locale, restriction }: RestrictionStandingProps) {
  const t = dictionary.adminPractice.standing;
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid', year: 'numeric' });
  const { closing, suspended } = restriction ?? { closing: null, suspended: null };

  if (!suspended && !closing) {
    return <Text tone="secondary">{dictionary.adminPractice.none}</Text>;
  }

  const entries = [
    suspended
      ? { headline: interpolate(t.suspended, { date: day(suspended.since) }), key: 'suspended', statement: suspended.statement, when: null }
      : null,
    closing
      ? {
          headline: interpolate(closing.closed ? t.closed : t.closing, { date: day(closing.closesAt) }),
          key: 'closing',
          statement: closing.statement,
          when: interpolate(t.decided, { date: day(closing.decidedAt) })
        }
      : null
  ].filter(entry => entry !== null);

  return (
    <div className={styles.standing}>
      {entries.map(entry => (
        <Card className={styles.entry} key={entry.key}>
          <p className={styles.headline}>{entry.headline}</p>
          {entry.when ? <p className={styles.when}>{entry.when}</p> : null}
          <p className={styles.reason}>
            {entry.statement ? (
              <OwnerFacts
                value={restrictionStatement(dictionary, {
                  authority: entry.statement.authority,
                  clause: entry.statement.clause,
                  facts: entry.statement.facts,
                  source: entry.statement.source
                })}
              />
            ) : (
              t.noStatement
            )}
          </p>
        </Card>
      ))}
    </div>
  );
}
