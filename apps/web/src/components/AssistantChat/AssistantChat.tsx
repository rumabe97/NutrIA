'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './AssistantChat.module.css';

import { Button } from 'ui/components/Button';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { AssistantMarkdown } from 'components/AssistantMarkdown';
import { AssistantWarning } from 'components/AssistantWarning';

import { api, ApiError, messageFor } from 'lib/api';
import { askAssistant, threadItems } from 'lib/assistant';
import { formatDate, interpolate } from 'lib/format';
import { warningOpenedAfter, warningState } from 'lib/assistantWarning';

import type { AssistantDecline, AssistantStanding, AssistantTurn } from 'lib/assistant';

/** The longest question the API takes (`ASSISTANT_MESSAGE_MAX_LENGTH`). */
const MAX_LENGTH = 1000;

/** How close to the end, in pixels, still counts as "reading the end" — the answer then keeps it in view. */
const FOLLOW_SLACK = 160;

/** Set before the page is replaced by the thread's own, so the new page puts focus back in the box. */
const FOCUS_AFTER_REPLACE = 'nutria-assistant-focus';

/** The id of a turn's delete button, so focus can go back to it. */
function deleteButtonId(key: string): string {
  return `assistant-delete-${key}`;
}

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

/** Whether the page is scrolled to (about) its end. */
function atEnd(): boolean {
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - FOLLOW_SLACK;
}

/** To the end of the page — at once when the person asked for less motion. */
function toEnd(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.scrollTo({ behavior: reduce ? 'auto' : 'smooth', top: document.documentElement.scrollHeight });
}

/** A screen where focus in a text box means an on-screen keyboard. */
function onTouchScreen(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * The conversation with the assistant (project 023), in the shape of a chat
 * app: the conversation fills the column, the box to write in stays at its
 * foot, and the end of the answer stays in view while it is written — unless the
 * person has scrolled up to read, in which case nothing moves under them.
 *
 * **The warning is the first message of every conversation**, drawn by this
 * component and not by the page, so no conversation can be shown without it
 * (PRD 12): whole while the conversation has no message, folded to its AI and
 * health sentence once it has one (`components/AssistantWarning`); and the line
 * under the box says the same two things in every state.
 *
 * The answer arrives a sentence at a time, each already checked by the API. A
 * decline that arrives after some sentences is added **beneath** them, never in
 * their place. The growing answer is not a live region; one polite status line
 * says it is being written, then that it finished or why it stopped. Focus stays
 * in the box while the answer streams.
 *
 * The box empties the moment a question is sent, and gets it back if the
 * question could not be sent at all. Nothing typed is kept in the browser beyond
 * the unsent text in the box, and nothing is sent anywhere but this service.
 */
export function AssistantChat({ conversationId, standing, turns }: AssistantChatProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const t = dictionary.assistant;
  const fieldId = useId();
  const hintId = useId();
  const warningId = useId();
  // The warning opened in full after it folded: this visit's React state only, never stored
  // (`docs/legal/2026-11-11-redesign.md` § 6.5).
  const [warningOpen, setWarningOpen] = useState(false);
  const [conversation, setConversation] = useState(conversationId);
  const [shown, setShown] = useState<readonly ShownTurn[]>(() =>
    turns.map(turn => ({ id: turn.id, content: turn.content, decline: turn.decline, key: turn.id, role: turn.role }))
  );
  // Emptied (every message deleted), the warning is FULL again, so the next message folds it
  // afresh rather than bringing it back expanded. Adjusted while rendering when the count
  // changes — the pattern React documents, no effect — and stored nowhere.
  const [counted, setCounted] = useState(shown.length);

  if (counted !== shown.length) {
    setCounted(shown.length);
    setWarningOpen(opened => warningOpenedAfter(opened, shown.length));
  }

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
  // A conversation with something in it is followed to its end from the start; a new one is
  // not — there is no end to follow yet, and it opens at its top. Sending turns it on.
  const following = useRef(turns.length > 0);

  /** A status said again is announced again: emptied first, then set. */
  const announce = (message: string) => {
    setStatus('');
    window.setTimeout(() => setStatus(message), 50);
  };

  /** The box grows with what is written, up to a cap its stylesheet sets, and shrinks back when emptied. */
  const fit = useCallback(() => {
    const box = field.current;

    if (box) {
      box.style.height = 'auto';
      box.style.height = `${String(box.scrollHeight)}px`;
    }
  }, []);

  // Opened on the end of the conversation, the way a chat opens; and with focus in the box when the
  // page was just replaced by the thread's own after a first answer (the person was typing there).
  // How many turns the page arrived with: what decides where it opens, once.
  const openedWith = useRef(turns.length);

  useEffect(() => {
    // Only a conversation that has something in it: a new one opens at its top, with the
    // warning whole under the bar (it opened a few pixels down, under it, on the owner's iPhone).
    if (openedWith.current > 0) {
      window.scrollTo({ top: document.documentElement.scrollHeight });
    }

    try {
      if (window.sessionStorage.getItem(FOCUS_AFTER_REPLACE)) {
        window.sessionStorage.removeItem(FOCUS_AFTER_REPLACE);

        // Not on a phone: focus there is the keyboard, and sending put it away.
        if (!onTouchScreen()) {
          field.current?.focus();
        }
      }
    } catch {
      // Storage refused (a private window): the focus is a convenience, nothing depends on it.
    }
  }, []);

  // Whether the person is reading the end: if they scrolled up, the answer stops pulling them down.
  useEffect(() => {
    const onScroll = () => {
      following.current = atEnd();
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Every new line of the conversation keeps the end in view, while the person is following it.
  useLayoutEffect(() => {
    if (following.current) {
      toEnd();
    }
  }, [shown, writing, problem]);

  useLayoutEffect(fit, [draft, fit]);

  // A confirmation that opens takes the focus.
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

      if (error.code === 'ASSISTANT_UNAVAILABLE') {
        // Said by the assistant: what failed, that it cost no message, and what to do.
        return error.message === 'budget' ? t.unavailableBudget : error.message === 'provider' ? t.unavailableProvider : t.unavailableNoModel;
      }

      if (error.code === 'NETWORK') {
        return t.unavailableNetwork;
      }

      if (error.code === 'NOT_FOUND') {
        return t.gone;
      }
    }

    return messageFor(error, dictionary);
  }

  async function send() {
    const question = draft.trim();

    if (question === '' || busy || spent) {
      return;
    }

    const controller = new AbortController();
    const opened = conversation === null;
    let answer = '';
    let started = false;
    let landedIn: string | null = conversation;

    // On a phone, sending puts the keyboard away so the answer has the screen (the owner,
    // 2026-11-12). The press itself never moved the focus — it would have moved the box
    // from under the finger — so it is given up here, once the question is on its way.
    if (onTouchScreen()) {
      field.current?.blur();
    }

    abort.current = controller;
    following.current = true;
    // Emptied at once, the way a chat does; given back below if the question never left.
    setDraft('');
    setProblem(null);
    announce(t.sending);
    setShown(previous => [...previous, { id: null, content: question, decline: null, key: key(), role: 'user' }]);
    setWriting('');

    try {
      await askAssistant(
        { ...(conversation ? { conversationId: conversation } : {}), message: question },
        streamed => {
          if (streamed.type === 'conversation') {
            started = true;
            landedIn = streamed.id;
            setConversation(streamed.id);
            setLeft(previous => Math.max(previous - 1, 0));
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
        // The question never left: it comes off the conversation and back into the box.
        const message = refusal(error);

        setShown(previous => previous.slice(0, -1));
        setDraft(previous => (previous === '' ? question : previous));
        setProblem(message);
        announce(message);
      }
    } finally {
      setWriting(null);
      abort.current = null;
    }

    if (opened && started && landedIn) {
      // Once the answer has ended — never in the middle of it — the address becomes the thread's,
      // so a reload or a second device finds it, and the history beside it gains it. The new page
      // puts the focus back in the box.
      try {
        window.sessionStorage.setItem(FOCUS_AFTER_REPLACE, '1');
      } catch {
        // Storage refused: the page still changes, only the focus is not put back.
      }

      router.replace(`/asistente/${landedIn}`, { scroll: false });
      router.refresh();
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
      // The message and its button are gone: the box is where to carry on.
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
              <AssistantWarning
                expanded={warningState(shown.length, warningOpen) === 'expanded'}
                folded={warningState(shown.length, warningOpen) !== 'full'}
                fullId={warningId}
                key="warning"
                onToggle={() => setWarningOpen(open => !open)}
                privacyHref={withLocale('/privacidad#asistente', locale)}
                t={t}
              />
            );
          }

          const { turn } = item;
          const mine = turn.role === 'user';

          return (
            // A turn this visit added drops into place; the stored ones are simply there.
            <li
              className={[mine ? styles.user : styles.assistant, turn.id === null ? 'motion-drop-in' : ''].filter(Boolean).join(' ')}
              key={turn.key}
            >
              <p className="visually-hidden">{mine ? t.you : t.answerLabel}</p>
              {turn.content !== '' ? (
                mine ? (
                  <p className={styles.bubble}>{turn.content}</p>
                ) : (
                  <AssistantMarkdown className={styles.answer} text={turn.content} />
                )
              ) : mine ? (
                // A question judged clinical is not kept, only its code: it is said, not shown.
                <p className={`${styles.bubble} ${styles.withdrawn}`}>{t.withdrawn}</p>
              ) : null}
              {/* A decline is the assistant saying what it is for, in its own words — an answer like any other. */}
              {!mine && turn.decline ? <p className={styles.answer}>{t.declines[turn.decline]}</p> : null}

              {turn.id ? (
                confirming === turn.key ? (
                  <div aria-label={t.deleteMessageLabel} className={`${styles.confirm} motion-drop-in`} role="group">
                    <p className={styles.confirmText}>{t.deleteMessageBody}</p>
                    <div className="button-row">
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
                  <button
                    aria-label={mine ? t.deleteQuestionLabel : t.deleteAnswerLabel}
                    className={styles.delete}
                    id={deleteButtonId(turn.key)}
                    onClick={() => setConfirming(turn.key)}
                    type="button"
                  >
                    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                      <path
                        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )
              ) : null}
            </li>
          );
        })}

        {writing === null ? null : (
          <li className={`${styles.assistant} motion-fade`}>
            <p className="visually-hidden">{t.answerLabel}</p>
            {writing === '' ? (
              <p className={styles.thinking}>
                <span aria-hidden="true" className={styles.dots}>
                  <span />
                  <span />
                  <span />
                </span>
                <span className="visually-hidden">{t.sending}</span>
              </p>
            ) : (
              <AssistantMarkdown className={styles.answer} text={writing} />
            )}
          </li>
        )}

        {/* What went wrong is said by the assistant, as a message of its own — never a box over the conversation. */}
        {problem ? (
          <li className={`${styles.assistant} motion-drop-in`}>
            <p className="visually-hidden">{t.answerLabel}</p>
            <p className={styles.answer}>{problem}</p>
          </li>
        ) : null}
      </ol>

      <p className="visually-hidden" role="status">
        {status}
      </p>

      <form
        className={styles.composer}
        onSubmit={event => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="visually-hidden" htmlFor={fieldId}>
          {t.field}
        </label>
        <div className={styles.box}>
          <textarea
            aria-describedby={hintId}
            className={styles.field}
            id={fieldId}
            maxLength={MAX_LENGTH}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              // Enter sends, Shift+Enter starts a line; never while a word is still being composed.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={t.placeholder}
            readOnly={spent}
            ref={field}
            rows={1}
            value={draft}
          />
          {/* Never `disabled` while writing or empty: disabling the focused button drops a keyboard user's
              focus to the page. It says it cannot be pressed instead, and `send` ignores the press. */}
          <button
            aria-disabled={busy || spent || draft.trim() === '' || undefined}
            aria-label={busy ? t.sending : t.send}
            className={styles.send}
            // Pressing it never takes the focus from the box. On a phone the press used to
            // blur the box first: the keyboard closed, the box dropped to the screen's foot
            // from under the finger, and the press landed on nothing — a second one was
            // needed to send (the owner's iPhone, 2026-11-12). The box keeps its focus and
            // the keyboard stays for the next question.
            onMouseDown={event => event.preventDefault()}
            onPointerDown={event => event.preventDefault()}
            type="submit"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className={styles.hint} id={hintId}>
          {/* The persistent label of the box: an AI answers, and no health data here — in every
              state of the warning, and read with the field (`aria-describedby`). */}
          {t.composerNotice} {allowance} <span className={styles.enter}>{t.enterHint}</span>
        </p>
      </form>
    </div>
  );
}
