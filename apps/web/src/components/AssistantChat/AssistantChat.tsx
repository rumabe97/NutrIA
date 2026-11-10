'use client';
import { useEffect, useId, useRef, useState } from 'react';

import styles from './AssistantChat.module.css';

import { Button } from 'ui/components/Button';
import { Link } from 'ui/components/Link';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { api, ApiError, messageFor } from 'lib/api';
import { askAssistant, threadItems } from 'lib/assistant';
import { formatDate, interpolate } from 'lib/format';

import type { AssistantDecline, AssistantStanding, AssistantTurn } from 'lib/assistant';

/** Where the warning's link to the privacy policy goes (`docs/legal/assistant-warning.md` § 1). */
const PRIVACY_PLACEHOLDER = '{privacy}';

/** The id of a turn's delete button, so focus can go back to it. */
function deleteButtonId(key: string): string {
  return `assistant-delete-${key}`;
}

/** The longest question the API takes (`ASSISTANT_MESSAGE_MAX_LENGTH`). */
const MAX_LENGTH = 1000;

/** A turn on screen: what the server stored, or what this visit has just added (no id until it is read back). */
type ShownTurn = {
  readonly id: string | null;
  readonly content: string;
  readonly decline: AssistantDecline | null;
  readonly key: string;
  readonly role: 'assistant' | 'user';
};

type AssistantChatProps = {
  /** The conversation this continues, or null for a new one. */
  readonly conversationId: string | null;
  readonly standing: AssistantStanding;
  readonly turns: readonly AssistantTurn[];
};

/**
 * The conversation with the assistant (project 023 phase 5).
 *
 * **The warning is the first message of every conversation**, drawn by this
 * component and not by the page, so no conversation can be shown without it:
 * not a banner dismissed once, but there every time a thread is opened (PRD 12).
 *
 * The answer arrives a sentence at a time, each already checked by the API.
 * A decline that arrives after some sentences is added **beneath** them, never
 * in their place: what was shown was checked, and taking it back would say
 * otherwise. A decline is the assistant saying what it is for, so it reads as
 * one of its messages and not as an error.
 *
 * The growing answer is not a live region — a screen reader re-reading a
 * paragraph on every sentence is noise. One polite status line says it is being
 * written, then that it finished or why it stopped. Focus stays where the person
 * left it.
 *
 * Nothing typed is kept in the browser beyond the unsent text in the field, and
 * nothing is sent anywhere but this service.
 */
export function AssistantChat({ conversationId, standing, turns }: AssistantChatProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.assistant;
  const fieldId = useId();
  const hintId = useId();
  const [conversation, setConversation] = useState(conversationId);
  const [shown, setShown] = useState<readonly ShownTurn[]>(() =>
    turns.map(turn => ({ id: turn.id, content: turn.content, decline: turn.decline, key: turn.id, role: turn.role }))
  );
  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [left, setLeft] = useState(standing.remaining);
  const [confirming, setConfirming] = useState<string | null>(null);
  const counter = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const confirmFirst = useRef<HTMLButtonElement>(null);

  /** A status said again is announced again: emptied first, then set. */
  const announce = (message: string) => {
    setStatus('');
    window.setTimeout(() => setStatus(message), 50);
  };

  // A confirmation that opens takes the focus; one that closes gives it back to the button that opened it.
  useEffect(() => {
    if (confirming) {
      confirmFirst.current?.focus();
    }
  }, [confirming]);

  /** Focus back on a turn's delete button once the confirmation that replaced it is gone. */
  const returnTo = (turnKey: string) => window.requestAnimationFrame(() => document.getElementById(deleteButtonId(turnKey))?.focus());

  // A person who leaves mid-answer stops paying for it.
  useEffect(() => () => abort.current?.abort(), []);

  const busy = writing !== null;
  const spent = left <= 0;

  const key = () => {
    counter.current += 1;

    return `new-${String(counter.current)}`;
  };

  const resetLine = () => {
    if (standing.resetsOn) {
      return interpolate(t.overAllowance, {
        date: formatDate(standing.resetsOn, locale, { day: 'numeric', month: 'long' }),
        limit: String(standing.limit)
      });
    }

    return interpolate(t.overAllowanceRolling, { limit: String(standing.limit) });
  };

  function refusal(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.code === 'QUOTA_EXCEEDED') {
        setLeft(0);

        return resetLine();
      }

      if (error.code === 'ASSISTANT_UNAVAILABLE' && error.message === 'budget') {
        return t.unavailableBudget;
      }

      if (error.code === 'NOT_FOUND') {
        return t.gone;
      }
    }

    return messageFor(error, dictionary);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();

    const question = draft.trim();

    if (question === '' || busy || spent) {
      return;
    }

    const controller = new AbortController();
    let answer = '';
    let started = false;

    abort.current = controller;
    setProblem(null);
    announce(t.sending);
    setWriting('');

    try {
      await askAssistant(
        { ...(conversation ? { conversationId: conversation } : {}), message: question },
        streamed => {
          if (streamed.type === 'conversation') {
            started = true;
            // The address stays as it is: changing it mid-answer moves a keyboard user's focus to the
            // page heading (Next treats it as a navigation). A reload finds the thread in the list.
            setConversation(streamed.id);
            // Only what was sent is cleared: anything typed since stays.
            setDraft(previous => (previous.trim() === question ? '' : previous));
            setLeft(previous => Math.max(previous - 1, 0));
            setShown(previous => [...previous, { id: null, content: question, decline: null, key: key(), role: 'user' }]);
          } else if (streamed.type === 'text') {
            answer += streamed.text;
            setWriting(answer);
          } else if (streamed.type === 'end') {
            setShown(previous => [...previous, { id: null, content: answer, decline: streamed.decline, key: key(), role: 'assistant' }]);
            announce(streamed.decline ? t.declines[streamed.decline] : t.done);
          } else {
            setShown(previous => [...previous, { id: null, content: answer, decline: null, key: key(), role: 'assistant' }]);
            setProblem(t.cutOff);
            announce(t.cutOff);
          }
        },
        controller.signal
      );
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      if (started) {
        // Cut off mid-answer: what was shown stays, and says so.
        setShown(previous => [...previous, { id: null, content: answer, decline: null, key: key(), role: 'assistant' }]);
        setProblem(t.cutOff);
        announce(t.cutOff);
      } else {
        const message = refusal(error);

        setProblem(message);
        announce(message);
      }
    } finally {
      setWriting(null);
      abort.current = null;
    }
  }

  async function remove(turn: ShownTurn) {
    if (!turn.id) {
      return;
    }

    try {
      await api(`/assistant/messages/${turn.id}`, { method: 'DELETE' });
      setShown(previous => previous.filter(item => item.key !== turn.key));
      announce(t.deleted);
      // The message and its button are gone: the field is where to carry on.
      field.current?.focus();
    } catch (error: unknown) {
      const message = messageFor(error, dictionary);

      setProblem(message);
      announce(message);
      returnTo(turn.key);
    } finally {
      setConfirming(null);
    }
  }

  const allowance = spent
    ? resetLine()
    : interpolate(standing.resetsOn ? t.left : t.leftRolling, { limit: String(standing.limit), remaining: String(left) });

  return (
    <div className={styles.root}>
      <ol aria-label={t.threadLabel} className={styles.thread}>
        {threadItems(shown).map(item => {
          if (item.kind === 'warning') {
            return (
              <li className={`${styles.turn} ${styles.assistant}`} key="warning">
                <p className={styles.speaker}>{t.warningLabel}</p>
                <p className={`${styles.bubble} ${styles.warning}`}>
                  {t.warning.split(/(\{privacy\})/).map(part =>
                    part === PRIVACY_PLACEHOLDER ? (
                      <Link href={withLocale('/privacidad#asistente', locale)} inline={true} key={part}>
                        {t.warningPrivacy}
                      </Link>
                    ) : (
                      part
                    )
                  )}
                </p>
              </li>
            );
          }

          const { turn } = item;

          return (
            <li className={`${styles.turn} ${turn.role === 'user' ? styles.user : styles.assistant}`} key={turn.key}>
              <p className={turn.role === 'user' ? 'visually-hidden' : styles.speaker}>{turn.role === 'user' ? t.you : t.answerLabel}</p>
              {turn.content !== '' ? (
                <p className={styles.bubble}>{turn.content}</p>
              ) : turn.role === 'user' ? (
                // A question judged clinical is not kept, only its code: it is said, not shown.
                <p className={`${styles.bubble} ${styles.withdrawn}`}>{t.withdrawn}</p>
              ) : null}
              {turn.role === 'assistant' && turn.decline ? <p className={`${styles.bubble} ${styles.decline}`}>{t.declines[turn.decline]}</p> : null}

              {turn.id ? (
                confirming === turn.key ? (
                  <div aria-label={t.deleteMessageLabel} className={styles.confirm} role="group">
                    <p className={styles.confirmText}>{t.deleteMessageBody}</p>
                    <div className={styles.confirmActions}>
                      <Button onClick={() => void remove(turn)} ref={confirmFirst} size="sm" variant="destructive">
                        {t.deleteMessage}
                      </Button>
                      <Button
                        onClick={() => {
                          setConfirming(null);
                          returnTo(turn.key);
                        }}
                        size="sm"
                        variant="tertiary"
                      >
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    aria-label={turn.role === 'user' ? t.deleteQuestionLabel : t.deleteAnswerLabel}
                    className={styles.delete}
                    id={deleteButtonId(turn.key)}
                    onClick={() => setConfirming(turn.key)}
                    size="sm"
                    variant="tertiary"
                  >
                    {t.deleteMessage}
                  </Button>
                )
              ) : null}
            </li>
          );
        })}

        {writing === null ? null : (
          <li className={`${styles.turn} ${styles.assistant}`}>
            <p className={styles.speaker}>{t.answerLabel}</p>
            <p className={`${styles.bubble} ${styles.writing}`}>{writing === '' ? <span className={styles.dots}>{t.sending}</span> : writing}</p>
          </li>
        )}
      </ol>

      <p className="visually-hidden" role="status">
        {status}
      </p>

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={event => void send(event)}>
        <label className={styles.label} htmlFor={fieldId}>
          {t.field}
        </label>
        <textarea
          aria-describedby={hintId}
          className={styles.field}
          id={fieldId}
          maxLength={MAX_LENGTH}
          onChange={event => setDraft(event.target.value)}
          readOnly={spent}
          ref={field}
          rows={3}
          value={draft}
        />
        <p className={styles.hint} id={hintId}>
          {interpolate(t.fieldHint, { max: String(MAX_LENGTH) })} {allowance}
        </p>
        {/* Never `disabled` while writing or empty: disabling the focused button drops a keyboard user's
            focus to the page. It says it cannot be pressed instead, and `send` ignores the press. */}
        <Button aria-disabled={busy || spent || draft.trim() === '' || undefined} type="submit" variant="primary">
          {busy ? t.sending : t.send}
        </Button>
      </form>
    </div>
  );
}
