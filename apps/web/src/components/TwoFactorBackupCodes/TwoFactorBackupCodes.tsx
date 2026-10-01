'use client';
import { useEffect, useId, useRef, useState } from 'react';

import styles from 'components/TwoFactorCard/TwoFactorCard.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { backupCodesFile } from 'lib/twoFactor';

interface TwoFactorBackupCodesProps {
  codes: readonly string[];
  /** The account's address, at the top of the downloaded file, so it says which account the codes open. */
  email: string;
  onDone: () => void;
}

/**
 * The backup codes, shown this once: the API never hands them out again, only new ones
 * in their place. Copy and a `.txt` download, then a box to tick before "Terminar" —
 * pressing it unticked says why on the box rather than being a disabled button that
 * says nothing. The codes live in this component's state and nowhere else.
 */
export function TwoFactorBackupCodes({ codes, email, onDone }: TwoFactorBackupCodesProps) {
  const dictionary = useDictionary();
  const t = dictionary.twoFactor;
  const [saved, setSaved] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [copied, setCopied] = useState<string>();
  const titleRef = useRef<HTMLParagraphElement>(null);
  // The box takes no ref (`ui/Checkbox` wraps Radix's): it is found by its id instead.
  const savedId = useId();
  const listId = useId();
  const unsavedId = useId();

  // What came before has left the page: focus goes to the title, which reads what this is.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(t.codesCopied);
    } catch {
      setCopied(t.copyFailed);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([backupCodesFile(codes, email, dictionary)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = t.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function done() {
    if (!saved) {
      setUnsaved(true);
      document.getElementById(savedId)?.focus();

      return;
    }

    onDone();
  }

  return (
    <div className={styles.step}>
      <p className={styles.question} ref={titleRef} tabIndex={-1}>
        {t.codesTitle}
      </p>
      <Text size="sm" tone="secondary">
        {t.codesBody}
      </Text>

      <p className="visually-hidden" id={listId}>
        {t.codesListLabel}
      </p>
      <ol aria-labelledby={listId} className={styles.codes}>
        {codes.map(code => (
          <li key={code}>
            <code>{code}</code>
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
      {/* Mounted empty, so "copied" is announced when its words arrive. */}
      <p className={copied ? styles.done : 'visually-hidden'} role="status">
        {copied ?? null}
      </p>

      <div className={styles.saved}>
        <Checkbox
          aria-describedby={unsaved && !saved ? unsavedId : undefined}
          aria-invalid={unsaved && !saved ? true : undefined}
          checked={saved}
          id={savedId}
          label={t.codesSaved}
          onCheckedChange={checked => setSaved(checked === true)}
        />
        {unsaved && !saved ? (
          <p aria-live="polite" className={styles.fieldError} id={unsavedId}>
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
