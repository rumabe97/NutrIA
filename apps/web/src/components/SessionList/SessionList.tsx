'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './SessionList.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { authClient, signOut } from 'lib/auth-client';
import { deviceLabel } from 'lib/deviceLabel';
import { forgetOfflineCopies } from 'lib/offline';
import { forgetPushOnThisDevice } from 'lib/push';
import { formatInstant, interpolate } from 'lib/format';
import { SIGN_IN_AGAIN_PATH } from 'lib/accountDeletion';

import type { Dictionary } from 'i18n/dictionaries/es-ES';

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
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.security;
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [closing, setClosing] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [closingOthers, setClosingOthers] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

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

  // Opening the question moves focus to it; cancelling hands focus back to the button that
  // opened it. Skipped on mount. A finished close moves focus itself (to the heading).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      return;
    }

    if (confirming) {
      confirmRef.current?.focus();
    }
  }, [confirming]);

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

    setState(previous => (previous.kind === 'ready' ? { kind: 'ready', rows: previous.rows.filter(other => other.id !== row.id) } : previous));
    setDone(interpolate(t.sessionClosed, { device: row.label }));
    // The button that had focus has just left the page with its row.
    headingRef.current?.focus();
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

  /** The menu's sign-out, then the sign-in page, which brings them back to the profile. */
  async function signOutAndBack() {
    setSigningOut(true);

    try {
      await forgetPushOnThisDevice();
      await signOut();
      await forgetOfflineCopies();
      router.push(SIGN_IN_AGAIN_PATH);
      router.refresh();
    } catch {
      // Offline, most likely: the button comes back.
      setSigningOut(false);
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
      {/* Mounted empty so what was closed is announced when it is. */}
      <div role="status">{done ? <p className={styles.done}>{done}</p> : null}</div>

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
            <Button loading={signingOut} onClick={() => void signOutAndBack()} type="button" variant="secondary">
              {t.signInAgain}
            </Button>
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
                  {interpolate(t.started, { date: formatInstant(row.createdAt, locale, DATE) })}
                  {' · '}
                  {interpolate(t.lastActive, { date: formatInstant(row.updatedAt, locale, DATE) })}
                </span>
              </div>
              {row.current ? (
                <span className={styles.current}>{t.thisDevice}</span>
              ) : (
                <Button
                  aria-label={interpolate(t.closeSessionLabel, { device: row.label })}
                  disabled={closingOthers || (closing !== undefined && closing !== row.id)}
                  loading={closing === row.id}
                  onClick={() => void close(row)}
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
        <div className={styles.confirm}>
          <p className={styles.question} ref={confirmRef} tabIndex={-1}>
            {t.closeOthersTitle}
          </p>
          <Text size="sm" tone="secondary">
            {t.closeOthersBody}
          </Text>
          <div className={styles.actions}>
            <Button loading={closingOthers} onClick={() => void closeOthers()} type="button" variant="destructive">
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
