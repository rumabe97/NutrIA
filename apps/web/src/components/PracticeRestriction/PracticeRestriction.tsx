import styles from './PracticeRestriction.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';

import { MailtoText } from 'components/MailtoText';

import { formatInstant } from 'lib/format';
import { restrictionParagraphs } from 'lib/practiceRestriction';

import type { PracticeRestrictionView } from 'core/controllers/Professional';

interface PracticeRestrictionProps {
  restriction: PracticeRestrictionView;
}

/**
 * What the owner has standing against the practice (PRD 025 scope 16, criterion
 * 24), on the practice's own page, so it can be read whatever happened to its
 * mail (`lib/practiceRestriction`). Critical, so never a toast: a warning note
 * at the top of the page.
 */
export async function PracticeRestriction({ restriction }: PracticeRestrictionProps) {
  const [dictionary, locale] = await Promise.all([getDictionary(), activeLocale()]);
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const paragraphs = restrictionParagraphs(restriction, dictionary.practice, day);

  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <Note as="section" className={styles.note} tone="warning" toneLabel={dictionary.common.noteTone.warning}>
      {paragraphs.map(paragraph => (
        <Text key={paragraph} size="sm">
          <MailtoText email={LEGAL_IDENTITY.email} text={paragraph} />
        </Text>
      ))}
    </Note>
  );
}
