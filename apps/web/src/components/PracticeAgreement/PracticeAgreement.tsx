'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PracticeAgreement.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'ui/components/Collapsible';
import { Heading } from 'ui/components/Heading';
import { interpolate } from 'i18n/interpolate';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { PracticeAgreementSection } from 'components/PracticeAgreementSection';

import { api, messageFor } from 'lib/api';

interface PracticeAgreementProps {
  /** The version `professionals.agreementVersion` must equal before the practice opens. */
  version: string;
}

// The documents say `{name}` and `{email}`; who that is lives in one file — same as `LegalScreen`.
function fill(text: string): string {
  return interpolate(text, LEGAL_IDENTITY);
}

/**
 * The gate `/consulta` shows in place of the workspace while
 * `professionals.agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION`
 * (`docs/legal/textos/01-acuerdo-profesional.md`): the professional's own
 * agreement, the practice plan's conditions as a second, foldable block, and
 * one checkbox that accepts both. Nothing else on the page renders until
 * `POST /care/practice/agreement` succeeds and the page is read again.
 */
export function PracticeAgreement({ version }: PracticeAgreementProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.practiceAgreement;
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function accept() {
    setError(undefined);
    setPending(true);

    try {
      await api('/care/practice/agreement', { body: { version }, method: 'POST' });
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  return (
    <Card as="section" className={styles.card} padding="lg">
      <Heading level="1" size="lg">
        {t.title}
      </Heading>

      {t.intro.map(paragraph => (
        <Text className={styles.paragraph} key={paragraph} tone="secondary">
          {fill(paragraph)}
        </Text>
      ))}

      <div className={styles.sections}>
        {t.sections.map(section => (
          <PracticeAgreementSection key={section.heading} level="2" section={section} />
        ))}
      </div>

      <Collapsible className={styles.terms}>
        <Heading level="2" size="xs">
          <CollapsibleTrigger className={styles.termsTrigger}>
            {t.terms.title}
            <span aria-hidden="true" className={styles.chevron} />
          </CollapsibleTrigger>
        </Heading>
        <CollapsibleContent>
          <div className={styles.sections}>
            {t.terms.sections.map(section => (
              <PracticeAgreementSection key={section.heading} level="3" section={section} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className={styles.accept}>
        <Checkbox checked={checked} label={t.checkbox} onCheckedChange={value => setChecked(value === true)} />
        <Text size="xs" tone="tertiary">
          {interpolate(t.version, { version })}
        </Text>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button disabled={!checked} loading={pending} onClick={() => void accept()} size="lg" type="button">
          {t.accept}
        </Button>
      </div>
    </Card>
  );
}
