'use client';
import { useEffect, useId, useRef, useState } from 'react';

import styles from 'components/TwoFactorCard/TwoFactorCard.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { useFleetingStatus } from 'hooks/useFleetingStatus';

import { backupCodesFile } from 'lib/twoFactor';
import { formatInstant, interpolate } from 'lib/format';

interface TwoFactorBackupCodesProps {
  codes: readonly string[];
  /** The account's address, at the top of the downloaded file, so it says which account the codes open. */
  email: string;
  onDone: () => void;
  /** The title, which carries the news on its own: the factor is on, or these replace the old ones. */
  title: string;
}

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * The backup codes, shown this once: the API never hands them out again, only new ones
 * in their place. Copy and a `.txt` download, then a box to tick before "Terminar" —
 * pressing it unticked says why under the box and moves there, rather than being a
 * disabled button that cannot be focused and says nothing. The codes live in this
 * component's state and nowhere else.
 */
export function TwoFactorBackupCodes({ codes, email, onDone, title }: TwoFactorBackupCodesProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.twoFactor;
  const [saved, setSaved] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  // Counts the unticked presses: focus moves once the error is on the page, and again on each press.
  const [nudge, setNudge] = useState(0);
  const [status, say] = useFleetingStatus();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // The box takes no ref (`ui/Checkbox` wraps Radix's): it is found by its id instead.
  const savedId = useId();
  const unsavedId = useId();
  const missing = unsaved && !saved;

  // After the commit, so the box is focused already described by its error and marked invalid.
  useEffect(() => {
    if (nudge > 0) {
      document.getElementById(savedId)?.focus();
    }
  }, [nudge, savedId]);

  // What came before has left the page: focus goes to the title, which says what happened.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      say(t.codesCopied);
    } catch {
      say(t.copyFailed);
    }
  }

  function download() {
    const file = backupCodesFile(codes, email, formatInstant(Date.now(), locale, DATE), dictionary);
    const url = URL.createObjectURL(new Blob([file], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = t.fileName;
    // In the document for the click, the safe form for older WebKit; the address is kept a
    // while, because Safari starts the download after the click has returned.
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    // The browser never says when it has finished, so this says it started.
    say(interpolate(t.downloading, { file: t.fileName }));
  }

  function done() {
    if (!saved) {
      setUnsaved(true);
      setNudge(previous => previous + 1);

      return;
    }

    onDone();
  }

  return (
    <div className={styles.step}>
      <h4 className={styles.question} id={titleId} ref={titleRef} tabIndex={-1}>
        {title}
      </h4>
      <Text size="sm" tone="secondary">
        {t.codesBody}
      </Text>

      {/* "List, 10 items": in rows, so the order read is the order seen. */}
      {/* `role="list"`: Safari drops the list role from a list drawn without markers. */}
      <ol aria-labelledby={titleId} className={styles.codes} role="list">
        {codes.map(code => (
          <li key={code}>
            <code translate="no">{code}</code>
          </li>
        ))}
      </ol>

      <div className={styles.actions}>
        <Button onClick={() => void copy()} type="button" variant="secondary">
          {t.copy}
        </Button>
        <Button onClick={download} type="button" variant="secondary">
          {t.download}
        </Button>
      </div>
      {/* Mounted empty, so what happened is announced when its words arrive. */}
      <p className={status ? styles.done : 'visually-hidden'} role="status">
        {status ?? null}
      </p>

      <div className={styles.saved}>
        <Checkbox
          aria-describedby={missing ? unsavedId : undefined}
          aria-invalid={missing ? true : undefined}
          checked={saved}
          id={savedId}
          label={t.codesSaved}
          onCheckedChange={checked => setSaved(checked === true)}
        />
        {missing ? (
          <p className={styles.fieldError} id={unsavedId}>
            {t.codesSavedMissing}
          </p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button onClick={done} type="button">
          {t.done}
        </Button>
      </div>
    </div>
  );
}
