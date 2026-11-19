'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import styles from './HideProfileForm.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Input } from 'ui/components/Input';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { AdminTextArea } from 'components/AdminTextArea';
import { ChoiceSet } from 'components/ChoiceSet';
import { StatementPreview } from 'components/StatementPreview';

import { hideProfessionalProfileSchema, PROFILE_HIDE_REASONS } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { hideStatement } from 'lib/ownerStatements';
import { interpolate } from 'lib/format';

import type { ProfileHideReason } from 'core/entities/Professional';
import type { QueuedProfileView } from 'core/controllers/Professional';

interface HideProfileFormProps {
  /** Closes the form and gives focus back to the button that opened it. */
  onCancel: () => void;
  /** The act went through (`hidden`), or the profile was no longer on the queue (`stale`). */
  onDone: (outcome: 'hidden' | 'stale') => void;
  profile: QueuedProfileView;
  /** The id the opening button names in `aria-controls`. */
  rootId: string;
}

/** The reasons that quote a word. */
const WORD_REASONS: readonly ProfileHideReason[] = ['badge_word', 'unchecked_title'];

/** The reasons as the mail lists them: the dictionary's order, which is the mail's. */
function orderOf(keys: readonly string[]): readonly ProfileHideReason[] {
  return keys.filter((key): key is ProfileHideReason => (PROFILE_HIDE_REASONS as readonly string[]).includes(key));
}

/**
 * Hiding a profile from the first look (PRD 025 criterion 18; `docs/legal/textos/06`
 * § X): refusing and hiding are one act, immediate, with one statement of reasons
 * the person receives. The owner picks from the approved sentences — each choice is
 * the sentence itself, with the word he quotes in it as he types it — adds the
 * facts, and says whether a notice set the look off. Below, the statement exactly as
 * the person will read it, and what the act does, before the button that does it.
 *
 * The same schema the API validates the body with runs here first, so a missing
 * word or an empty reason is named on its field and nothing leaves the page.
 */
export function HideProfileForm({ onCancel, onDone, profile, rootId }: HideProfileFormProps) {
  const dictionary = useDictionary();
  const t = dictionary.adminProfiles.hide;
  const reasonSentences = dictionary.practice.profileHiddenReasons;
  const [reasons, setReasons] = useState<readonly ProfileHideReason[]>([]);
  const [word, setWord] = useState(profile.withheld[0]?.word ?? '');
  const [facts, setFacts] = useState('');
  const [afterNotice, setAfterNotice] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'facts' | 'reasons' | 'word', string>>>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const quotesWord = reasons.some(reason => WORD_REASONS.includes(reason));
  const order = useMemo(() => orderOf(Object.keys(reasonSentences)), [reasonSentences]);

  // Opening the form puts the reader at its start: the buttons that opened it are above, and the fields are what he is here for.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('button, input, textarea')?.focus();
  }, []);

  const statement = hideStatement(dictionary, { afterNotice, facts, reasons, word });

  function toggle(reason: ProfileHideReason, checked: boolean) {
    setReasons(current => (checked ? [...current, reason] : current.filter(existing => existing !== reason)));
    setErrors(current => ({ ...current, reasons: undefined }));
  }

  async function submit() {
    setError(undefined);

    const body = { afterNotice, facts: facts.trim() === '' ? undefined : facts.trim(), reasons, word: quotesWord ? word.trim() : undefined };
    const parsed = hideProfessionalProfileSchema.safeParse(body);

    if (!parsed.success) {
      const paths = new Set(parsed.error.issues.map(issue => issue.path[0]));
      const next = {
        facts: paths.has('facts') ? t.factsPlain : undefined,
        reasons: paths.has('reasons') ? t.factsRequired : undefined,
        word: paths.has('word') ? t.wordRequired : undefined
      };

      setErrors(next);
      // The first field that refused takes focus, so the person who pressed does not have to look for it.
      requestAnimationFrame(() => {
        (root.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? root.current?.querySelector<HTMLElement>('[role="checkbox"]'))?.focus();
      });

      return;
    }

    setErrors({});
    setPending(true);

    try {
      await api(`/admin/professionals/${encodeURIComponent(profile.userId)}/profile/hide`, { body: parsed.data, method: 'POST' });
      onDone('hidden');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        onDone('stale');
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div aria-labelledby={titleId} className={styles.form} id={rootId} ref={root} role="group">
      <h4 className={styles.title} id={titleId}>
        {interpolate(t.title, { name: profile.displayName })}
      </h4>

      <ChoiceSet error={errors.reasons} legend={t.legendReasons}>
        {order.map(reason => (
          <Checkbox
            checked={reasons.includes(reason)}
            key={reason}
            label={interpolate(reasonSentences[reason], { word: word.trim() === '' ? '…' : word.trim() })}
            onCheckedChange={checked => toggle(reason, checked === true)}
          />
        ))}
      </ChoiceSet>

      {quotesWord ? (
        <Input
          autoComplete="off"
          error={errors.word}
          hint={t.wordHint}
          label={t.word}
          lang="es"
          maxLength={60}
          onChange={event => {
            setWord(event.currentTarget.value);
            setErrors(current => ({ ...current, word: undefined }));
          }}
          spellCheck={false}
          value={word}
        />
      ) : null}

      <AdminTextArea
        error={errors.facts}
        hint={t.factsHint}
        label={t.factsLabel}
        maxLength={1000}
        onChange={event => {
          setFacts(event.currentTarget.value);
          setErrors(current => ({ ...current, facts: undefined, reasons: undefined }));
        }}
        value={facts}
      />

      <Checkbox checked={afterNotice} label={t.afterNotice} onCheckedChange={checked => setAfterNotice(checked === true)} />

      <StatementPreview note={t.previewNote} title={t.preview} what={statement.what} why={statement.why} />

      <Text size="sm">{t.consequence}</Text>

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      <div className="button-row">
        <Button disabled={pending} onClick={onCancel} type="button" variant="secondary">
          {t.cancel}
        </Button>
        <Button aria-disabled={pending || undefined} loading={pending} onClick={() => void submit()} type="button" variant="destructive">
          {t.submit}
        </Button>
      </div>
    </div>
  );
}
