'use client';
import { useEffect, useRef } from 'react';

import styles from './BadgeIssuedCode.module.css';

import { Button } from 'ui/components/Button';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { BadgeLetter } from 'components/BadgeLetter';
import { BadgeScript } from 'components/BadgeScript';

import { formatInstant, interpolate } from 'lib/format';

/** A code just made for a letter or a call: held in the page's state only, from this answer until the owner says he is done. */
export interface IssuedCode {
  channel: 'phone' | 'post';
  code: string;
  expiresAt: string;
  /** The name as the register shows it, typed on this screen to complete the letter or the script; never sent. */
  registerName: string;
}

interface BadgeIssuedCodeProps {
  /** The college and the number the application declares — the letter's and the script's. */
  declared: { number: string; register: string };
  issued: IssuedCode;
  /** The owner is done with the code: it is wiped from the page. */
  onDone: () => void;
  /** The privacy policy's address, whole: a letter has no links. */
  privacyUrl: string;
}

/**
 * The code, shown once (PLAN 025 phase 3 step 3; `textos/06` §§ S and T): the API keeps
 * only its hash, so this answer is the only time anyone reads it. It stays on screen
 * until the owner says he has used it — a refresh would lose it — together with what to
 * do with it: the letter to print, or the script to read, with the college, the number
 * and the expiry filled in. It takes focus when it appears, so the person who pressed
 * the button is looking at it. Nothing here is logged or stored.
 */
export function BadgeIssuedCode({ declared, issued, onDone, privacyUrl }: BadgeIssuedCodeProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminBadge;
  const root = useRef<HTMLDivElement>(null);
  // The letter and the script are in Spanish whatever the console's language: their dates are too.
  const expires = formatInstant(Date.parse(issued.expiresAt), 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const shown = formatInstant(Date.parse(issued.expiresAt), locale, { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    root.current?.focus();
  }, []);

  return (
    <div className={styles.root}>
      <div aria-label={t.step2.codeLabel} className={styles.shown} ref={root} role="group" tabIndex={-1}>
        <Note as="p" tone="warning" toneLabel={dictionary.common.noteTone.warning}>
          {t.step2.codeOnce}
        </Note>
        {issued.channel === 'phone' ? <p className={styles.code}>{issued.code}</p> : null}
        <Text size="sm">{interpolate(t.step2.codeValid, { date: shown })}</Text>
      </div>

      <div className={styles.how}>
        <h3 className={styles.title}>{issued.channel === 'post' ? t.letter.title : t.script.title}</h3>
        <Text size="sm" tone="secondary">
          {issued.channel === 'post' ? t.letter.how : t.script.how}
        </Text>
        {issued.channel === 'post' ? (
          <BadgeLetter
            letter={t.letter}
            values={{
              code: issued.code,
              email: LEGAL_IDENTITY.email,
              expires,
              name: LEGAL_IDENTITY.name,
              number: declared.number,
              privacyUrl,
              register: declared.register,
              registerName: issued.registerName
            }}
          />
        ) : (
          <BadgeScript script={t.script} values={{ expires, register: declared.register, registerName: issued.registerName }} />
        )}
      </div>

      <div className="button-row">
        <Button onClick={onDone} type="button" variant="secondary">
          {t.step2.done}
        </Button>
      </div>
    </div>
  );
}
