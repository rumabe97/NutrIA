'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PracticeNameForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Note } from 'ui/components/Note';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { authClient } from 'lib/auth-client';

interface PracticeNameFormProps {
  /** The account's name as `GET /users/me` gives it. */
  name: string;
}

/**
 * The account's own name, changed where a practitioner needs it (PRD 025, LOG
 * phase 6): the name a client sees in the invitation, its mail and their link,
 * which the API judges for titles when the practitioner invites and whenever a
 * client is shown it. Refused at an invitation, the form there links here
 * (`#nombre`).
 *
 * Better Auth's own `update-user`, through its client, with the name and
 * nothing else. No word is judged here: the API judges the name where it is
 * shown, and an invitation that still fails says the word again.
 */
export function PracticeNameForm({ name }: PracticeNameFormProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.practice;
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function rename(next: string) {
    setSaved(false);
    setError(undefined);
    setFieldError(undefined);

    if (next.length === 0) {
      setFieldError(dictionary.errors.invalidInput);

      return;
    }

    setPending(true);

    const { error: refused } = await authClient.updateUser({ name: next });

    setPending(false);

    if (refused) {
      setError(dictionary.errors.request);

      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    // The field's own label names the card: a heading with the same words would say it twice.
    <Card className={styles.card} id="nombre">
      <form
        className={styles.form}
        noValidate={true}
        onSubmit={event => {
          event.preventDefault();
          void rename(String(new FormData(event.currentTarget).get('name') ?? '').trim());
        }}
      >
        <Input autoComplete="name" defaultValue={name} error={fieldError} label={t.nameTitle} name="name" required={true} />
        {error ? (
          <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
            {error}
          </Note>
        ) : null}
        {saved ? (
          <Note as="p" className="motion-drop-in" role="status" tone="success" toneLabel={dictionary.common.noteTone.success}>
            {t.nameSaved}
          </Note>
        ) : null}
        <div className={styles.actions}>
          <Button loading={pending} type="submit" variant="secondary">
            {t.nameCta}
          </Button>
        </div>
      </form>
    </Card>
  );
}
