'use client';
import { Fragment, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './BadgeCheck.module.css';

import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { BadgeCodeStep } from 'components/BadgeCodeStep';
import { BadgeDecision } from 'components/BadgeDecision';
import { BadgeIssuedCode } from 'components/BadgeIssuedCode';
import { BadgeStep } from 'components/BadgeStep';

import { badgeActs } from 'lib/badgeActs';
import { formatInstant, interpolate } from 'lib/format';

import type { BadgeCodeIssuedView, BadgeRecordView } from 'core/controllers/Professional';
import type { IssuedCode } from 'components/BadgeIssuedCode';

interface BadgeCheckProps {
  /** The privacy policy's address, whole: a letter has no links. */
  privacyUrl: string;
  record: BadgeRecordView;
}

/**
 * One practitioner's badge, checked in three numbered steps (sheet
 * «ConsolaDistintivo», PRD 025 criteria 3 and 5): 1 look at the register, 2 send
 * the code, 3 decide. The steps drawn are the ones the record allows (`badgeActs`):
 * a request waiting has all three; a standing badge due for its yearly check has them
 * with the code optional; a standing badge not yet due can only be withdrawn; nothing
 * else has a step at all — the record under the page is the whole of it.
 *
 * The code made for a letter or a call is **held here**, in this component's state: the
 * API keeps only its hash and the answer is the one time it exists. The page is read
 * again only after the owner says he is done with it, so a refresh never wipes it
 * before he has used it. Every result is said in one region that stays mounted, and
 * takes focus once the page has moved on, because the button that was pressed may be
 * gone. A step that finds the record already changed says so and reads it again.
 */
export function BadgeCheck({ privacyUrl, record }: BadgeCheckProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminBadge;
  const [result, setResult] = useState<{ text: string; tone: 'success' | 'warning' }>();
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const status = useRef<HTMLDivElement>(null);
  const said = useRef(false);
  const acts = badgeActs(record);
  const declared = record.application ?? record.badge;
  const decided = { number: declared?.number ?? '', register: declared?.register ?? '' };
  const standing = acts.mode === 'standing';
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });

  // The result is announced where it is, then focus goes to it once the page has been read again.
  useEffect(() => {
    if (said.current && result) {
      said.current = false;
      status.current?.focus();
    }
  }, [result, record]);

  function say(text: string, tone: 'success' | 'warning' = 'success') {
    said.current = true;
    setResult({ text, tone });
    router.refresh();
  }

  function mailed(answer: BadgeCodeIssuedView) {
    if (answer.mailed === false) {
      say(t.step2.notMailed, 'warning');
    } else {
      say(interpolate(t.step2.mailed, { date: day(answer.expiresAt) }));
    }
  }

  return (
    <div className={styles.check}>
      {/* Mounted from the start, so the first message is announced too; it is the page's one place for a result. */}
      <div className={styles.status} ref={status} role="status" tabIndex={-1}>
        {result ? (
          <Note as="p" tone={result.tone} toneLabel={dictionary.common.noteTone[result.tone]}>
            {result.text}
          </Note>
        ) : null}
      </div>

      {acts.mode === 'nothing' ? null : (
        <Fragment>
          <BadgeStep number={1} title={t.step1.title}>
            <Text>{interpolate(standing ? t.step1.bodyStanding : t.step1.body, { number: decided.number, register: decided.register })}</Text>
          </BadgeStep>

          {acts.canSendCode ? (
            <BadgeStep number={2} title={t.step2.title}>
              {issued ? (
                <BadgeIssuedCode
                  declared={decided}
                  issued={issued}
                  onDone={() => {
                    setIssued(null);
                    say(t.step2.handed);
                  }}
                  privacyUrl={privacyUrl}
                />
              ) : (
                <BadgeCodeStep onIssued={setIssued} onMailed={mailed} onStale={() => say(t.stale, 'warning')} record={record} />
              )}
            </BadgeStep>
          ) : null}

          <BadgeStep number={3} title={t.decide.title}>
            <BadgeDecision acts={acts} decided={decided} onDone={text => say(text)} onStale={() => say(t.stale, 'warning')} record={record} />
          </BadgeStep>
        </Fragment>
      )}
    </div>
  );
}
