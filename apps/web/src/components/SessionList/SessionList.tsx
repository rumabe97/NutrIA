'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import styles from './SessionList.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { SignInAgainButton } from 'components/SignInAgainButton';

import { authClient } from 'lib/auth-client';
import { deviceLabel } from 'lib/deviceLabel';
import { formatInstant, interpolate } from 'lib/format';

import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { KeyboardEvent } from 'react';

/** One row of the list: what Better Auth's `/list-sessions` returns, narrowed to what is drawn. */
interface SessionRow {
  id: string;
  createdAt: number;
  current: boolean;
  label: string;
  /** What `/revoke-session` takes. Never shown, never stored: it lives in this state and goes back to the API. */
  token: string;
  updatedAt: number;
}

/**
 * - `notFresh`: Better Auth lists sessions only to one started within its `freshAge` (a day)
 *   and answers `SESSION_NOT_FRESH` otherwise. Closing the others needs no list, so that stays.
 */
type ListState = { kind: 'failed' } | { kind: 'loading' } | { kind: 'notFresh' } | { kind: 'ready'; rows: SessionRow[] };

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };

/** The list, and which row is this device, from Better Auth's own two routes. */
async function readSessions(dictionary: Dictionary): Promise<ListState> {
  const [sessions, current] = await Promise.all([authClient.listSessions(), authClient.getSession()]);

  if (sessions.error) {
    return sessions.error.code === 'SESSION_NOT_FRESH' ? { kind: 'notFresh' } : { kind: 'failed' };
  }

  const currentId = current.data?.session.id;
  const rows = sessions.data
    .map(session => ({
      id: session.id,
      createdAt: new Date(session.createdAt).getTime(),
      current: session.id === currentId,
      label: deviceLabel(session.userAgent, dictionary),
      token: session.token,
      updatedAt: new Date(session.updatedAt).getTime()
    }))
    // This device first, then the most recently used.
    .sort((a, b) => Number(b.current) - Number(a.current) || b.updatedAt - a.updatedAt);

  return { kind: 'ready', rows };
}

/**
 * Where this account is signed in, from Better Auth's own routes, which only ever list and
 * close the session's own user's sessions.
 *
 * "Última actividad" is the session's `updatedAt`, which Better Auth moves at most once a
 * day — so it is a date, never a time. Closing another device's session ends it on the
 * API at once; that device keeps its offline copy until it next connects (`0053`), and the
 * copy above the list says so.
 */
export function SessionList() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.security;
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [closing, setClosing] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [closingOthers, setClosingOthers] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRefs = useRef(new Map<string, HTMLButtonElement>());
  // Where focus goes once the list has been drawn without the row that had it.
  const focusNext = useRef<string | null>(null);
  const mounted = useRef(false);
  const questionId = useId();
  const consequenceId = useId();

  const load = useCallback(
    () =>
      readSessions(dictionary)
        // Offline, most likely: the list says it could not load, with a retry.
        .catch((): ListState => ({ kind: 'failed' }))
        .then(setState),
    [dictionary]
  );

  // The first load starts from 'loading'; a retry says 'loading' itself before calling it.
  useEffect(() => {
    void load();
  }, [load]);

  // Opening the question moves focus to its answer, which carries the question as its
  // description; the trigger it replaces has left the page. Skipped on mount.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      return;
    }

    if (confirming) {
      confirmRef.current?.focus();
    }
  }, [confirming]);

  // A closed row takes its focused button with it: the next row's button takes focus, or
  // the previous one's, or the heading when no other row is left.
  useEffect(() => {
    if (focusNext.current === null) {
      return;
    }

    const target = closeRefs.current.get(focusNext.current);

    focusNext.current = null;
    (target ?? headingRef.current)?.focus();
  }, [state]);

  function failed(status: number) {
    setError(status === 429 ? dictionary.auth.tooManyAttempts : dictionary.errors.internal);
  }

  async function close(row: SessionRow) {
    setError(undefined);
    setDone(undefined);
    setClosing(row.id);

    const { error: revokeError } = await authClient.revokeSession({ token: row.token });

    setClosing(undefined);

    if (revokeError) {
      failed(revokeError.status);

      return;
    }

    setState(previous => {
      if (previous.kind !== 'ready') {
        return previous;
      }

      const others = previous.rows.filter(other => !other.current);
      const index = others.findIndex(other => other.id === row.id);

      focusNext.current = (others[index + 1] ?? others[index - 1])?.id ?? '';

      return { kind: 'ready', rows: previous.rows.filter(other => other.id !== row.id) };
    });
    setDone(interpolate(t.sessionClosed, { device: row.label }));
  }

  async function closeOthers() {
    setError(undefined);
    setDone(undefined);
    setClosingOthers(true);

    const { error: revokeError } = await authClient.revokeOtherSessions();

    setClosingOthers(false);

    if (revokeError) {
      failed(revokeError.status);

      return;
    }

    setConfirming(false);
    setDone(t.othersClosed);
    setState(previous => (previous.kind === 'ready' ? { kind: 'ready', rows: previous.rows.filter(row => row.current) } : previous));
    headingRef.current?.focus();
  }

  function cancel() {
    setConfirming(false);
    // Focus goes back once the button is on the page again.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  /** Escape answers the question with "no", as it would in a dialog. */
  function onConfirmKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !closingOthers) {
      event.preventDefault();
      cancel();
    }
  }

  const others = state.kind === 'ready' ? state.rows.filter(row => !row.current).length : null;
  // With no list to go by, closing the others is still offered: it needs no fresh session.
  const canCloseOthers = state.kind === 'notFresh' || (others !== null && others > 0);

  return (
    <div className={styles.root}>
      <h3 className={styles.title} ref={headingRef} tabIndex={-1}>
        {t.sessionsTitle}
      </h3>
      <Text size="sm" tone="secondary">
        {t.sessionsBody}
      </Text>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {/* Mounted empty, so what was closed is announced when its words arrive; out of the
          layout until then, so it adds no gap. */}
      <p className={done ? styles.done : 'visually-hidden'} role="status">
        {done ?? null}
      </p>

      {state.kind === 'loading' ? (
        <Text size="sm" tone="secondary">
          {t.sessionsLoading}
        </Text>
      ) : null}

      {state.kind === 'failed' ? (
        <div className={styles.actions}>
          <Text size="sm" tone="secondary">
            {t.sessionsFailed}
          </Text>
          <Button
            onClick={() => {
              setState({ kind: 'loading' });
              void load();
            }}
            type="button"
            variant="secondary"
          >
            {dictionary.common.retry}
          </Button>
        </div>
      ) : null}

      {state.kind === 'notFresh' ? (
        <div className={styles.notFresh}>
          <Text size="sm">{t.sessionsNotFresh}</Text>
          <div className={styles.actions}>
            <SignInAgainButton />
          </div>
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <ul className={styles.list}>
          {state.rows.map(row => (
            <li className={styles.row} key={row.id}>
              <div className={styles.device}>
                <span className={styles.label}>{row.label}</span>
                <span className={styles.meta}>
                  <time dateTime={new Date(row.createdAt).toISOString()}>
                    {interpolate(t.started, { date: formatInstant(row.createdAt, locale, DATE) })}
                  </time>
                  <time dateTime={new Date(row.updatedAt).toISOString()}>
                    {interpolate(t.lastActive, { date: formatInstant(row.updatedAt, locale, DATE) })}
                  </time>
                </span>
              </div>
              {row.current ? (
                <span className={styles.current}>{t.thisDevice}</span>
              ) : (
                <Button
                  // Two sessions on the same browser read the same: the date tells them apart.
                  aria-label={interpolate(t.closeSessionLabel, { date: formatInstant(row.createdAt, locale, DATE), device: row.label })}
                  disabled={closingOthers || closing !== undefined}
                  loading={closing === row.id}
                  onClick={() => void close(row)}
                  ref={element => {
                    if (element) {
                      closeRefs.current.set(row.id, element);
                    } else {
                      closeRefs.current.delete(row.id);
                    }
                  }}
                  type="button"
                  variant="secondary"
                >
                  {t.closeSession}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {state.kind === 'ready' && others === 0 ? (
        <Text size="sm" tone="secondary">
          {t.noOtherSessions}
        </Text>
      ) : null}

      {canCloseOthers && confirming ? (
        <div className={styles.confirm} onKeyDown={onConfirmKeyDown}>
          <p className={styles.question} id={questionId}>
            {t.closeOthersTitle}
          </p>
          <Text id={consequenceId} size="sm" tone="secondary">
            {t.closeOthersBody}
          </Text>
          <div className={styles.actions}>
            {/* Nothing is deleted, so not red; the one filled button while the question is open. */}
            <Button
              aria-describedby={`${questionId} ${consequenceId}`}
              loading={closingOthers}
              onClick={() => void closeOthers()}
              ref={confirmRef}
              type="button"
            >
              {t.closeOthersConfirm}
            </Button>
            <Button disabled={closingOthers} onClick={cancel} type="button" variant="secondary">
              {dictionary.common.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      {canCloseOthers && !confirming ? (
        <div className={styles.actions}>
          <Button disabled={closing !== undefined} onClick={() => setConfirming(true)} ref={triggerRef} type="button" variant="secondary">
            {t.closeOthers}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
