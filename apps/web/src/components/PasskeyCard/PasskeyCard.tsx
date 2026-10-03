'use client';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import styles from './PasskeyCard.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { SignInAgainButton } from 'components/SignInAgainButton';
import { TwoFactorPasswordStep } from 'components/TwoFactorPasswordStep';

import { authClient } from 'lib/auth-client';
import { deviceLabel } from 'lib/deviceLabel';
import { formatInstant, interpolate } from 'lib/format';
import { passkeyAddRefusal, passkeysSupported, unchanging } from 'lib/passkey';

import type { KeyboardEvent } from 'react';
import type { TwoFactorRefusal } from 'lib/twoFactor';

/** One row: what `/passkey/list-user-passkeys` returns, narrowed to what is drawn. */
interface PasskeyRow {
  id: string;
  createdAt: number;
  /** The name it was given, or the generic one. */
  label: string;
}

/** `notFresh`: Better Auth answered `SESSION_NOT_FRESH`; only signing in again shows the list. */
type ListState = { kind: 'failed' } | { kind: 'loading' } | { kind: 'notFresh' } | { kind: 'ready'; rows: PasskeyRow[] };

/**
 * - `password`: the password asked before the browser's prompt, on an account that has one.
 * - `remove`: the question before a passkey is removed.
 */
type Step = { kind: 'idle' } | { kind: 'password' } | { kind: 'remove'; row: PasskeyRow };

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** The list, newest first — the one just added is where the eye lands — from the plugin's own route. */
async function readPasskeys(unnamed: string): Promise<ListState> {
  const { data, error } = await authClient.passkey.listUserPasskeys();

  if (error) {
    return error.code === 'SESSION_NOT_FRESH' ? { kind: 'notFresh' } : { kind: 'failed' };
  }

  const rows = data
    .map(passkey => ({ id: passkey.id, createdAt: new Date(passkey.createdAt).getTime(), label: passkey.name || unnamed }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return { kind: 'ready', rows };
}

interface PasskeyCardProps {
  /** The account's address, for the password field's hidden username. */
  email: string;
  /** `UserView.hasPassword`: the password confirms an addition; without one, a recent sign-in does. */
  hasPassword: boolean;
}

/**
 * Passkeys in "Seguridad" (PLAN 011 phase 5): the list (name and date), add and remove,
 * over the passkey plugin's own routes, which only ever touch the session's own user's
 * passkeys.
 *
 * Adding one asks first who is there — the password on an account that has one, a
 * sign-in from the last minutes on one that does not, which the API checks — then the
 * browser's own prompt. A prompt closed without finishing is said nothing about.
 * Removing one asks first, inline, the way `SessionList` does.
 *
 * Drawn only once the page knows the browser has WebAuthn — the card and its surface:
 * the server cannot know it, so the card arrives after the first client render.
 */
export function PasskeyCard({ email, hasPassword }: PasskeyCardProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.passkeys;
  const supported = useSyncExternalStore(unchanging, passkeysSupported, () => false);
  const host = useSyncExternalStore(
    unchanging,
    () => window.location.host,
    () => ''
  );
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  // Each failure remounts the alert, so the same refusal twice is announced twice.
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef(new Map<string, HTMLButtonElement>());
  // Where focus goes once the card is drawn again: a row's button, "Añadir" or the title.
  const returnTo = useRef<string | null>(null);
  const questionId = useId();
  const consequenceId = useId();

  const load = useCallback(
    () =>
      readPasskeys(t.unnamed)
        // Offline, most likely: the list says it could not load, with a retry.
        .catch((): ListState => ({ kind: 'failed' }))
        .then(setState),
    [t.unnamed]
  );

  // The first load starts from 'loading'; a retry says 'loading' itself before calling it.
  useEffect(() => {
    if (supported) {
      void load();
    }
  }, [load, supported]);

  // Opening the question moves focus to its answer, which carries the question as its description.
  useEffect(() => {
    if (step.kind === 'remove') {
      confirmRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (step.kind !== 'idle' || returnTo.current === null) {
      return;
    }

    const target = returnTo.current === 'add' ? addRef.current : (removeRefs.current.get(returnTo.current) ?? headingRef.current);

    returnTo.current = null;
    target?.focus();
  }, [state, step]);

  function back(to: string, said?: string) {
    returnTo.current = to;
    setDone(said);
    setStep({ kind: 'idle' });
  }

  function fail(message: string) {
    setError(message);
    setAttempt(previous => previous + 1);
  }

  /**
   * The browser's prompt, then the list again. The name is this device as the session list
   * reads it ("Safari en iPhone"): the person never has to type one, and two keys tell
   * themselves apart. What went wrong comes back, already in words, for whoever asked.
   */
  async function register(password?: string): Promise<TwoFactorRefusal | undefined> {
    // On an account with a password, the password first: right, it lets one passkey
    // through for ten minutes; wrong, it stays on the field.
    if (password !== undefined) {
      const { error: confirmError } = await authClient.$fetch<{ status: boolean }>('/passkey/confirm-password', {
        body: { password },
        method: 'POST'
      });

      if (confirmError) {
        const refusal = passkeyAddRefusal(confirmError, dictionary);

        return refusal.kind === 'password'
          ? { field: 'password', message: refusal.message, restart: false }
          : { field: null, message: confirmError.status === 429 ? dictionary.auth.tooManyAttempts : dictionary.errors.internal, restart: false };
      }
    }

    const name = deviceLabel(navigator.userAgent, dictionary);
    const { error: addError } = await authClient.passkey.addPasskey({ name });

    if (!addError) {
      setStale(false);
      await load();
      back('heading', t.added);

      return undefined;
    }

    const refusal = passkeyAddRefusal(addError, dictionary);

    switch (refusal.kind) {
      case 'cancelled':
        back('add');

        return undefined;
      case 'password':
        return { field: 'password', message: refusal.message, restart: false };
      case 'stale':
        // "Añadir" gives way to the sentence and its button; the title takes focus above them.
        setStale(true);
        back('heading');

        return undefined;
      case 'failed':
        if (password !== undefined) {
          return { field: null, message: refusal.message, restart: false };
        }

        fail(refusal.message);

        return undefined;
    }
  }

  async function add() {
    setError(undefined);
    setDone(undefined);

    if (hasPassword) {
      setStep({ kind: 'password' });

      return;
    }

    setAdding(true);
    await register();
    setAdding(false);
  }

  async function remove(row: PasskeyRow) {
    setError(undefined);
    setDone(undefined);
    setRemoving(true);

    const { error: removeError } = await authClient.passkey.deletePasskey({ id: row.id });

    setRemoving(false);

    if (removeError && removeError.status !== 404) {
      if (removeError.code === 'SESSION_NOT_FRESH') {
        // The question and its button leave the page: the title takes focus, above the sentence that says why.
        returnTo.current = 'heading';
        setStep({ kind: 'idle' });
        setState({ kind: 'notFresh' });

        return;
      }

      fail(removeError.status === 429 ? dictionary.auth.tooManyAttempts : dictionary.errors.internal);

      return;
    }

    // Gone either way: removed now, or already (another tab, another device).
    setState(previous => {
      if (previous.kind !== 'ready') {
        return previous;
      }

      const index = previous.rows.findIndex(other => other.id === row.id);

      returnTo.current = (previous.rows[index + 1] ?? previous.rows[index - 1])?.id ?? 'heading';

      return { kind: 'ready', rows: previous.rows.filter(other => other.id !== row.id) };
    });
    setDone(removeError ? t.removeGone : interpolate(t.removed, { name: row.label }));
    setStep({ kind: 'idle' });
  }

  /** Escape answers the question with "no", as it would in a dialog. */
  function onConfirmKeyDown(event: KeyboardEvent<HTMLDivElement>, row: PasskeyRow) {
    if (event.key === 'Escape' && !removing) {
      event.preventDefault();
      back(row.id);
    }
  }

  if (!supported) {
    return null;
  }

  const busy = adding || removing || step.kind !== 'idle';

  return (
    <Card as="section" className={styles.root}>
      <h3 className={styles.title} ref={headingRef} tabIndex={-1}>
        {t.title}
      </h3>
      <Text size="sm" tone="secondary">
        {interpolate(t.body, { host })}
      </Text>
      {hasPassword ? (
        <Text size="sm" tone="secondary">
          {t.resetNote}
        </Text>
      ) : null}

      {error ? (
        <p className={styles.error} key={attempt} role="alert">
          {error}
        </p>
      ) : null}
      {/* Mounted empty, so what changed is announced when its words arrive; out of the
          layout until then, so it adds no gap. */}
      <p className={done ? styles.done : 'visually-hidden'} role="status">
        {done ?? null}
      </p>

      {state.kind === 'loading' ? (
        <Text size="sm" tone="secondary">
          {t.loading}
        </Text>
      ) : null}

      {state.kind === 'failed' ? (
        <div className={styles.actions}>
          <Text size="sm" tone="secondary">
            {t.listFailed}
          </Text>
          <Button
            onClick={() => {
              // This button leaves the page with the failure: the title takes focus.
              returnTo.current = 'heading';
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

      {state.kind === 'notFresh' || stale ? (
        <div className={styles.notFresh}>
          <Text size="sm">{state.kind === 'notFresh' ? t.listNotFresh : t.stale}</Text>
          <div className={styles.actions}>
            <SignInAgainButton />
          </div>
        </div>
      ) : null}

      {state.kind === 'ready' && state.rows.length > 0 ? (
        <ul className={styles.list}>
          {state.rows.map(row => {
            const date = formatInstant(row.createdAt, locale, DATE);

            return (
              <li className={styles.row} key={row.id}>
                <div className={styles.passkey}>
                  <span className={styles.label}>{row.label}</span>
                  <time className={styles.meta} dateTime={new Date(row.createdAt).toISOString()}>
                    {interpolate(t.addedOn, { date })}
                  </time>
                </div>
                <Button
                  aria-label={interpolate(t.removeLabel, { date, name: row.label })}
                  disabled={busy}
                  onClick={() => {
                    setError(undefined);
                    setDone(undefined);
                    setStep({ kind: 'remove', row });
                  }}
                  ref={element => {
                    if (element) {
                      removeRefs.current.set(row.id, element);
                    } else {
                      removeRefs.current.delete(row.id);
                    }
                  }}
                  type="button"
                  variant="secondary"
                >
                  {t.remove}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {state.kind === 'ready' && state.rows.length === 0 ? (
        <Text size="sm" tone="secondary">
          {t.none}
        </Text>
      ) : null}

      {step.kind === 'remove' ? (
        <div className={styles.confirm} onKeyDown={event => onConfirmKeyDown(event, step.row)}>
          <p className={styles.question} id={questionId}>
            {interpolate(t.removeTitle, { name: step.row.label })}
          </p>
          <Text id={consequenceId} size="sm" tone="secondary">
            {t.removeBody}
          </Text>
          <div className={styles.actions}>
            <Button
              aria-describedby={`${questionId} ${consequenceId}`}
              loading={removing}
              onClick={() => void remove(step.row)}
              ref={confirmRef}
              type="button"
              variant="destructive"
            >
              {t.removeConfirm}
            </Button>
            <Button disabled={removing} onClick={() => back(step.row.id)} type="button" variant="secondary">
              {dictionary.common.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      {step.kind === 'password' ? (
        <TwoFactorPasswordStep
          body={t.addBody}
          confirm={dictionary.common.continue}
          email={email}
          onCancel={() => back('add')}
          onSubmit={password => register(password)}
          title={t.addTitle}
        />
      ) : null}

      {/* Offered while the list is readable, or failed to load (adding needs no list), and never once only a fresh sign-in lets it through. */}
      {step.kind === 'password' || stale || state.kind === 'notFresh' || state.kind === 'loading' ? null : (
        <div className={styles.actions}>
          <Button
            disabled={removing || step.kind !== 'idle'}
            loading={adding}
            onClick={() => void add()}
            ref={addRef}
            type="button"
            variant="secondary"
          >
            {t.add}
          </Button>
        </div>
      )}
    </Card>
  );
}
