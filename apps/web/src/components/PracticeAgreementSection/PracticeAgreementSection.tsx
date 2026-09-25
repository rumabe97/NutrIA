import styles from './PracticeAgreementSection.module.css';

import { Heading } from 'ui/components/Heading';
import { interpolate } from 'i18n/interpolate';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { Text } from 'ui/components/Text';

import type { Dictionary } from 'i18n/dictionaries/es-ES';

type AgreementSection = Dictionary['practiceAgreement']['sections'][number];
type TermsSection = Dictionary['practiceAgreement']['terms']['sections'][number];

interface PracticeAgreementSectionProps {
  /** The document's own sections sit directly under the page's `h1`; the practice terms nest one level deeper, under their own `h2`. */
  level: '2' | '3';
  section: AgreementSection | TermsSection;
}

// The documents say `{name}` and `{email}`; who that is lives in one file — same as `LegalScreen`.
function fill(text: string): string {
  return interpolate(text, LEGAL_IDENTITY);
}

/**
 * One numbered section of the professional's agreement or the practice
 * plan's terms (`PracticeAgreement`), in the order the source document gives
 * it: an optional lead paragraph, an optional list, an optional closing
 * paragraph after the list — `outro`, for the one section (`Usos
 * prohibidos` / `Prohibited uses`) that reads a warning after its list.
 */
export function PracticeAgreementSection({ level, section }: PracticeAgreementSectionProps) {
  return (
    <section className={styles.section}>
      <Heading level={level} size="xs">
        {section.heading}
      </Heading>

      {section.paragraphs.map(paragraph => (
        <Text className={styles.paragraph} key={paragraph}>
          {fill(paragraph)}
        </Text>
      ))}

      {'list' in section && section.list ? (
        <ul className={styles.list}>
          {section.list.map(item => (
            <li key={item}>
              <Text as="span">{fill(item)}</Text>
            </li>
          ))}
        </ul>
      ) : null}

      {'outro' in section && section.outro
        ? section.outro.map(paragraph => (
            <Text className={styles.paragraph} key={paragraph}>
              {fill(paragraph)}
            </Text>
          ))
        : null}
    </section>
  );
}
