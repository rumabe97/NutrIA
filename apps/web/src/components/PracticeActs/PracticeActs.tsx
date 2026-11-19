'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PracticeActs.module.css';

import { Note } from 'ui/components/Note';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { ActCard } from 'components/ActCard';
import { LiftForm } from 'components/LiftForm';
import { RestrictionForm } from 'components/RestrictionForm';

import { formatInstant, interpolate } from 'lib/format';

import type { LiftKind } from 'lib/ownerStatements';
import type { PracticeRestrictionView } from 'core/controllers/Professional';

interface PracticeActsProps {
  /** Whether the account has a practice now: a closed one (false) can only be lifted. */
  practising: boolean;
  restriction: PracticeRestrictionView | null;
  userId: string;
}

/**
 * The owner's three acts on one practitioner (PRD 025 criterion 24, scope 16): suspend,
 * close with 30 days' notice, and lift — each its own card, each with its form and its
 * consequence stated before the button. An act is drawn only when the API would take
 * it: a practice that works can be suspended and closed, a suspension or a close that
 * stands can be lifted, and a closed account (`practising: false`) has only the lift.
 *
 * What an act did is said in one region that stays mounted and takes focus once the
 * page has been read again — the card that held the button may be gone. An act the
 * API finds already done or undone (a 404: another tab, or the daily sweep got there
 * first) says so and reads the page again; the owner never has to guess.
 */
export function PracticeActs({ practising, restriction, userId }: PracticeActsProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminPractice;
  const [result, setResult] = useState<{ text: string; tone: 'success' | 'warning' }>();
  const status = useRef<HTMLDivElement>(null);
  const said = useRef(false);
  const suspended = restriction?.suspended ?? null;
  const closing = restriction?.closing ?? null;
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid', year: 'numeric' });

  useEffect(() => {
    if (said.current && result) {
      said.current = false;
      status.current?.focus();
    }
  }, [result, restriction]);

  function say(text: string, tone: 'success' | 'warning' = 'success') {
    said.current = true;
    setResult({ text, tone });
    router.refresh();
  }

  const stale = () => say(t.acts.stale, 'warning');
  const liftKind: LiftKind = closing ? (closing.closed ? 'closeAfter' : 'closeBefore') : 'suspension';

  return (
    <div className={styles.acts}>
      {/* Mounted from the start, so the first result is announced too. */}
      <div className={styles.status} ref={status} role="status" tabIndex={-1}>
        {result ? (
          <Note as="p" tone={result.tone} toneLabel={dictionary.common.noteTone[result.tone]}>
            {result.text}
          </Note>
        ) : null}
      </div>

      {practising && !suspended ? (
        <ActCard title={t.suspend.title}>
          <RestrictionForm alsoSuspended={false} kind="suspend" onDone={() => say(t.suspend.done)} onStale={stale} userId={userId} />
        </ActCard>
      ) : null}

      {practising && !closing ? (
        <ActCard title={t.close.title}>
          <RestrictionForm
            alsoSuspended={suspended !== null}

            kind="close"
            onDone={answer => say(interpolate(t.close.done, { date: answer.restriction?.closing ? day(answer.restriction.closing.closesAt) : '' }))}
            onStale={stale}
            userId={userId}
          />
        </ActCard>
      ) : null}

      {suspended || closing ? (
        <ActCard title={t.lift.title}>
          <LiftForm
            closeOn={closing?.closesAt ?? null}
            kind={liftKind}
            onDone={() => say(t.lift.done)}
            onStale={stale}
            suspended={suspended !== null}
            userId={userId}
          />
        </ActCard>
      ) : null}
    </div>
  );
}
