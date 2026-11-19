'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PracticeOpen.module.css';

import { ageInYears } from 'core/domain/Nutrition';
import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { AGE_YEARS } from 'core/entities/Profile';

import { api, ApiError, messageFor } from 'lib/api';
import { markPracticeOpened } from 'lib/practiceOpened';

interface PracticeOpenProps {
  /** No birth date on record (`GET /profile`): the form asks for one, which the opening stores. */
  askBirthDate: boolean;
}

/**
 * Opening one's own practice (PRD 025 scope 1, criterion 1; sheet
 * «AbrirConsulta»), drawn only while `UserView.canOpenPractice` says the door
 * exists. The words are `docs/legal/textos/01` § Pantallas P1. One primary
 * action: `POST /care/practice`, with the birth date only when none is on
 * record — the route takes nothing else.
 *
 * Every refusal is the route's one 404 (an unconfirmed address, under 18, a
 * standing restriction): the form says it could not open the practice and never
 * why, because the route does not say either. A date under 18 typed here is
 * caught first, with the onboarding's own sentence, as `OnboardingFlow` does.
 *
 * On success the page is read again and shows the agreement in place of this
 * form; `markPracticeOpened` lets the agreement take focus when it arrives.
 */
export function PracticeOpen({ askBirthDate }: PracticeOpenProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.practice;
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();

  async function open(birthDate: string | null) {
    setError(undefined);
    setFieldError(undefined);

    if (askBirthDate) {
      if (!birthDate) {
        setFieldError(dictionary.errors.invalidInput);

        return;
      }

      if (ageInYears(birthDate) < AGE_YEARS.min) {
        setFieldError(dictionary.errors.underMinimumAge);

        return;
      }
    }

    setPending(true);

    try {
      await api('/care/practice', { body: askBirthDate ? { birthDate } : {}, method: 'POST' });
      markPracticeOpened();
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        setError(t.openRefused);
      } else if (caught instanceof ApiError && caught.code === 'INVALID_INPUT') {
        setFieldError(dictionary.errors.invalidInput);
      } else {
        setError(messageFor(caught, dictionary));
      }

      setPending(false);
    }
  }

  const form = (
    <form
      className={styles.form}
      noValidate={true}
      onSubmit={event => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get('birthDate');

        void open(typeof value === 'string' && value !== '' ? value : null);
      }}
    >
      {askBirthDate ? (
        <Input
          autoComplete="bday"
          error={fieldError}
          hint={t.openBirthDateHint}
          label={t.openBirthDate}
          name="birthDate"
          required={true}
          type="date"
        />
      ) : null}

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      <div className={styles.actions}>
        <Button loading={pending} size="lg" type="submit">
          {t.openCta}
        </Button>
      </div>
    </form>
  );

  return (
    <div className={`${styles.root} motion-list`}>
      <div>
        <h1 className={styles.title}>{t.openTitle}</h1>
        <Text className={styles.intro} tone="secondary">
          {t.openIntro}
        </Text>
      </div>

      <Card aria-labelledby="open-badge-title" as="section" className={styles.card}>
        <h2 className={styles.cardTitle} id="open-badge-title">
          {t.badgeTitle}
        </h2>
        <Text size="sm" tone="secondary">
          {t.badgeApplyIntro}
        </Text>
      </Card>

      {/* The one action. With a field to fill it sits on its card; alone, a card around a single
          button would only frame it. */}
      {askBirthDate ? (
        <Card as="section" className={styles.card}>
          {form}
        </Card>
      ) : (
        form
      )}
    </div>
  );
}
