'use client';
import { useState } from 'react';

import styles from './LiftForm.module.css';

import { Button } from 'ui/components/Button';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { AdminTextArea } from 'components/AdminTextArea';
import { StatementPreview } from 'components/StatementPreview';

import { liftRestrictionSchema } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant } from 'lib/format';
import { liftStatement } from 'lib/ownerStatements';

import type { LiftKind } from 'lib/ownerStatements';
import type { PracticeRestrictionAnswerView } from 'core/controllers/Professional';

interface LiftFormProps {
  /** When the announced close would have closed the practice: its statement names it. Null when no close stands. */
  closeOn: string | null;
  /** Which mail the lift sends: a close not yet carried out, one that was, or a suspension alone. */
  kind: LiftKind;
  onDone: (answer: PracticeRestrictionAnswerView) => void;
  onStale: () => void;
  /** Whether a suspension stands too: the lift of a close not yet carried out then says it lifted that as well. */
  suspended: boolean;
  userId: string;
}

/**
 * Lifting what stands against a practice (`docs/legal/textos/06` §§ W bis.2 and 4): the
 * suspension and the close together, with what the owner found, or nothing. The words
 * the person reads differ with what was lifted, and the page says so before the button:
 * a suspension lifted gives the practice back; a close not yet carried out never
 * happens; a close that **was** carried out leaves its links ended and its badge
 * withdrawn — the person can open a practice again and accept the agreement again, and
 * that is all. The facts continue the approved sentence «Lo hemos revisado y…».
 */
export function LiftForm({ closeOn, kind, onDone, onStale, suspended, userId }: LiftFormProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminPractice.lift;
  const [facts, setFacts] = useState('');
  const [error, setError] = useState<string>();
  const [factsError, setFactsError] = useState<string>();
  const [pending, setPending] = useState(false);
  const closeDate = closeOn
    ? formatInstant(Date.parse(closeOn), locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid', year: 'numeric' })
    : '';
  const statement = liftStatement(dictionary, { closeDate, facts, kind, suspended });
  const consequence = { closeAfter: t.consequenceClosed, closeBefore: t.consequenceClosing, suspension: t.consequenceSuspended }[kind];

  async function submit() {
    setError(undefined);

    const parsed = liftRestrictionSchema.safeParse({ facts: facts.trim() === '' ? undefined : facts.trim() });

    if (!parsed.success) {
      setFactsError(dictionary.adminPractice.acts.factsPlain);

      return;
    }

    setFactsError(undefined);
    setPending(true);

    try {
      const answer = await api<PracticeRestrictionAnswerView>(`/admin/professionals/${encodeURIComponent(userId)}/lift`, {
        body: parsed.data,
        method: 'POST'
      });

      onDone(answer);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        onStale();
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={styles.form}
      noValidate={true}
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <Text weight="semibold">{t.lead}</Text>
      <Text size="sm">{consequence}</Text>

      <AdminTextArea
        error={factsError}
        hint={t.factsHint}
        label={t.facts}
        maxLength={1000}
        onChange={event => setFacts(event.currentTarget.value)}
        value={facts}
      />

      <StatementPreview note={dictionary.adminPractice.acts.previewNote} title={dictionary.adminPractice.acts.preview} why={statement} />

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      <div className="button-row">
        <Button aria-disabled={pending || undefined} loading={pending} type="submit">
          {t.submit}
        </Button>
      </div>
    </form>
  );
}
