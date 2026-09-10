'use client';
import { useId, useState } from 'react';

import styles from './FeedbackForm.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';

const KINDS = ['idea', 'problem', 'other'] as const;

/**
 * Writing to the owner (`0037`).
 *
 * Deliberately small: a kind, a box, a button. Every field added to a form like
 * this is a reason not to fill it in, and the thing being asked for — somebody
 * bothering to say what they think — is fragile enough already.
 */
export function FeedbackForm() {
  const dictionary = useDictionary();
  const t = dictionary.feedback;
  const messageId = useId();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('idea');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(undefined);

    try {
      await api('/feedback', { body: { kind, message }, method: 'POST' });
      setMessage('');
      setSent(true);
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={styles.root}>
      <h2 className={styles.title}>{t.title}</h2>
      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>

      <form className={styles.form} onSubmit={event => void submit(event)}>
        {/* The three pills read as one question, and a question a screen reader
            never hears is three unexplained radios. The legend is hidden rather
            than dropped: the pills say what they are, but only to somebody
            looking at them. */}
        <fieldset className={styles.kinds}>
          <legend className="visually-hidden">{t.kindsLabel}</legend>
          {KINDS.map(option => (
            <label className={styles.kind} key={option}>
              <input checked={kind === option} name="kind" onChange={() => setKind(option)} type="radio" value={option} />
              <span className={styles.pill}>{t.kinds[option]}</span>
            </label>
          ))}
        </fieldset>

        <label className="visually-hidden" htmlFor={messageId}>
          {t.messageLabel}
        </label>
        <textarea
          className={styles.message}
          id={messageId}
          maxLength={2000}
          onChange={event => {
            setMessage(event.target.value);
            setSent(false);
          }}
          placeholder={t.placeholder}
          rows={5}
          value={message}
        />

        <Button disabled={sending || message.trim().length === 0} loading={sending} type="submit">
          {t.send}
        </Button>
      </form>

      {/* Said once and plainly. A product that thanks you three times for one
          message is a product that wants credit for listening. */}
      {sent ? (
        <Text role="status" size="sm" tone="secondary">
          {t.thanks}
        </Text>
      ) : null}

      {error ? (
        <Text className={styles.error} role="alert" size="xs">
          {error}
        </Text>
      ) : null}
    </section>
  );
}
