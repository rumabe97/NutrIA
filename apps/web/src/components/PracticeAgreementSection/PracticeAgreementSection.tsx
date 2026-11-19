import styles from './PracticeAgreementSection.module.css';

import { Heading } from 'ui/components/Heading';
import { interpolate } from 'i18n/interpolate';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { Text } from 'ui/components/Text';

import type { Dictionary } from 'i18n/dictionaries/es-ES';

type AgreementSection = Dictionary['practiceAgreement']['sections'][number];

interface PracticeAgreementSectionProps {
  section: AgreementSection;
}

// The documents say `{name}` and `{email}`; who that is lives in one file — same as `LegalScreen`.
function fill(text: string): string {
  return interpolate(text, LEGAL_IDENTITY);
}

/** One list of the section's items: the section's own, or a group's. */
function listOf(items: readonly string[]) {
  return (
    <ul className={styles.list}>
      {items.map(item => (
        <li key={item}>
          <Text as="span">{fill(item)}</Text>
        </li>
      ))}
    </ul>
  );
}

/**
 * One numbered section of the professional's agreement (`PracticeAgreement`),
 * in the order the source document gives it (`docs/legal/textos/01`, 2.0.0):
 * optional lead paragraphs, an optional list, then optional groups — a lead in
 * bold over its own list — which is how § 3 says what each tier sees («Sin la
 * insignia», «Con la insignia», «En los dos casos») and § 13 what follows a
 * breach.
 */
export function PracticeAgreementSection({ section }: PracticeAgreementSectionProps) {
  return (
    <section className={styles.section}>
      <Heading level="2" size="xs">
        {section.heading}
      </Heading>

      {section.paragraphs.map(paragraph => (
        <Text className={styles.paragraph} key={paragraph}>
          {fill(paragraph)}
        </Text>
      ))}

      {'list' in section && section.list ? listOf(section.list) : null}

      {'groups' in section && section.groups
        ? section.groups.map(group => (
            <div className={styles.group} key={group.lead}>
              <Text className={styles.paragraph} weight="semibold">
                {fill(group.lead)}
              </Text>
              {listOf(group.list)}
            </div>
          ))
        : null}
    </section>
  );
}
