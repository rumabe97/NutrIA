'use client';
import { useEffect, useRef, useState } from 'react';

import styles from './CarriedResult.module.css';

import { Note } from 'ui/components/Note';
import { useDictionary } from 'i18n/LocaleProvider';

import { takeCarriedResult } from 'lib/consoleResult';

/**
 * Where a console act that left its own page says what it did (`lib/consoleResult`):
 * a status region mounted from the start, filled once on arrival, and focused, so
 * the result is both announced and where the reader is.
 */
export function CarriedResult() {
  const dictionary = useDictionary();
  const [text, setText] = useState<string | null>(null);
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const carried = takeCarriedResult();

    if (carried) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the carried result is in browser storage, only readable after hydration.
      setText(carried);
    }
  }, []);

  useEffect(() => {
    if (text) {
      region.current?.focus();
    }
  }, [text]);

  return (
    <div className={styles.region} ref={region} role="status" tabIndex={-1}>
      {text ? (
        <Note as="p" tone="success" toneLabel={dictionary.common.noteTone.success}>
          {text}
        </Note>
      ) : null}
    </div>
  );
}
