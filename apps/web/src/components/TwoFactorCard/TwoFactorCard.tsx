'use client';
import { useEffect, useRef, useState } from 'react';

import styles from './TwoFactorCard.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { TwoFactorBackupCodes } from 'components/TwoFactorBackupCodes';
import { TwoFactorPasswordStep } from 'components/TwoFactorPasswordStep';
import { TwoFactorSetup } from 'components/TwoFactorSetup';

import { authClient } from 'lib/auth-client';
import { twoFactorRefusal } from 'lib/twoFactor';

import type { TwoFactorRefusal } from 'lib/twoFactor';

type Action = 'disable' | 'enable' | 'regenerate';

/**
 * - `password`: the password every change asks for first.
 * - `scan`: the secret exists but is not confirmed; the factor is still off. The backup
 *   codes `/enable` answered with wait here, shown only once the factor is on.
 * - `codes`: the codes, this once.
 */
type Step =
  | { action: Action; kind: 'password' }
  | { backupCodes: readonly string[]; kind: 'scan'; totpUri: string }
  | { codes: readonly string[]; kind: 'codes'; said: string; title: string }
  | { kind: 'idle' };

interface TwoFactorCardProps {
  /** The account's address, for the password fields' hidden username and the codes' file. */
  email: string;
  /** `UserView.twoFactorEnabled` when the page was drawn. */
  enabled: boolean;
}

/**
 * The optional second factor in "Seguridad": an authenticator app, with ten backup
 * codes. Only drawn for an account with a password — Better Auth's two-factor routes
 * ask for it, and the API refuses `/enable` without one.
 *
 * Every change is a step inline in this card, not a dialog: on, off, new codes, each
 * behind the password. Focus follows each step — into the password, to the title of
 * what replaced it, and back to the button that started it when cancelled. What
 * happened is said in a status line mounted empty, so it is announced.
 */
export function TwoFactorCard({ email, enabled: enabledAtLoad }: TwoFactorCardProps) {
  const dictionary = useDictionary();
  const t = dictionary.twoFactor;
  const [enabled, setEnabled] = useState(enabledAtLoad);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [done, setDone] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const enableRef = useRef<HTMLButtonElement>(null);
  const regenerateRef = useRef<HTMLButtonElement>(null);
  const disableRef = useRef<HTMLButtonElement>(null);
  // Where focus goes once the card is back to its buttons: one of them, or the title.
  const returnTo = useRef<'heading' | Action | null>(null);

  useEffect(() => {
    if (step.kind !== 'idle' || returnTo.current === null) {
      return;
    }

    const target = { disable: disableRef, enable: enableRef, heading: headingRef, regenerate: regenerateRef }[returnTo.current].current;

    returnTo.current = null;
    target?.focus();
  }, [step]);

  function open(action: Action) {
    setDone(undefined);
    setStep({ action, kind: 'password' });
  }

  function back(to: 'heading' | Action, said?: string) {
    returnTo.current = to;
    setDone(said);
    setStep({ kind: 'idle' });
  }

  async function submitPassword(action: Action, password: string): Promise<TwoFactorRefusal | undefined> {
    if (action === 'enable') {
      const { data, error } = await authClient.twoFactor.enable({ password });

      if (error) {
        return twoFactorRefusal(error.code, error.status, dictionary, 'settings');
      }

      // The API offers no other method (no email codes); a reply without a key is a fault.
      if (!('totpURI' in data)) {
        return twoFactorRefusal(undefined, 500, dictionary, 'settings');
      }

      setStep({ backupCodes: data.backupCodes, kind: 'scan', totpUri: data.totpURI });

      return undefined;
    }

    if (action === 'disable') {
      const { error } = await authClient.twoFactor.disable({ password });

      if (error) {
        return twoFactorRefusal(error.code, error.status, dictionary, 'settings');
      }

      setEnabled(false);
      back('heading', t.disabled);

      return undefined;
    }

    const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });

    if (error) {
      return twoFactorRefusal(error.code, error.status, dictionary, 'settings');
    }

    setStep({ codes: data.backupCodes, kind: 'codes', said: t.regenerated, title: t.codesTitleRegenerated });

    return undefined;
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h3 className={styles.title} ref={headingRef} tabIndex={-1}>
          {t.title}
        </h3>
        {/* In words and in weight, not a colour. */}
        <span className={enabled ? styles.on : styles.off}>{enabled ? t.statusOn : t.statusOff}</span>
      </div>
      <Text size="sm" tone="secondary">
        {enabled ? t.bodyOn : t.bodyOff}
      </Text>

      {/* Mounted empty, so what changed is announced when its words arrive; out of the
          layout until then, so it adds no gap. */}
      <p className={done ? styles.done : 'visually-hidden'} role="status">
        {done ?? null}
      </p>

      {step.kind === 'idle' && !enabled ? (
        <div className={styles.actions}>
          <Button onClick={() => open('enable')} ref={enableRef} type="button" variant="secondary">
            {t.activate}
          </Button>
        </div>
      ) : null}

      {step.kind === 'idle' && enabled ? (
        <div className={styles.actions}>
          <Button onClick={() => open('regenerate')} ref={regenerateRef} type="button" variant="secondary">
            {t.regenerate}
          </Button>
          <Button onClick={() => open('disable')} ref={disableRef} type="button" variant="destructive">
            {t.disable}
          </Button>
        </div>
      ) : null}

      {step.kind === 'password' && step.action === 'enable' ? (
        <TwoFactorPasswordStep
          body={t.passwordStep}
          confirm={dictionary.common.continue}
          email={email}
          onCancel={() => back('enable')}
          onSubmit={password => submitPassword('enable', password)}
          title={t.stepPassword}
        />
      ) : null}

      {step.kind === 'password' && step.action === 'disable' ? (
        <TwoFactorPasswordStep
          body={t.disableBody}
          confirm={t.disableConfirm}
          destructive={true}
          email={email}
          onCancel={() => back('disable')}
          onSubmit={password => submitPassword('disable', password)}
          title={t.disableTitle}
        />
      ) : null}

      {step.kind === 'password' && step.action === 'regenerate' ? (
        <TwoFactorPasswordStep
          body={t.regenerateBody}
          confirm={t.regenerateConfirm}
          email={email}
          onCancel={() => back('regenerate')}
          onSubmit={password => submitPassword('regenerate', password)}
          title={t.regenerateTitle}
        />
      ) : null}

      {step.kind === 'scan' ? (
        <TwoFactorSetup
          onCancel={() => back('enable')}
          onConfirmed={() => {
            setEnabled(true);
            setStep({ codes: step.backupCodes, kind: 'codes', said: t.enabled, title: t.codesTitleEnabled });
          }}
          totpUri={step.totpUri}
        />
      ) : null}

      {step.kind === 'codes' ? (
        <TwoFactorBackupCodes codes={step.codes} email={email} onDone={() => back('heading', step.said)} title={step.title} />
      ) : null}
    </div>
  );
}
