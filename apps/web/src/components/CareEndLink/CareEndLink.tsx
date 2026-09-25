'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareEndLink.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

interface CareEndLinkProps {
  linkId: string;
  name: string;
}

/**
 * *Terminar vínculo*, from the professional's side: the same route the client
 * ends it with (`DELETE /care/links/:linkId`), behind the same inline confirm
 * `CareLinkCard` uses, with what it does said before it is done. Back to the
 * list once it has, since this page no longer opens.
 */
export function CareEndLink({ linkId, name }: CareEndLinkProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.practice;
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const confirmHeading = useRef<HTMLParagraphElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  // Neither side of the swap keeps the focused node; move it with the content, but not on first render.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      return;
    }

    if (confirming) {
      confirmHeading.current?.focus();
    } else {
      trigger.current?.focus();
    }
  }, [confirming]);

  async function end() {
    setError(undefined);
    setPending(true);

    try {
      await api(`/care/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
      router.push('/consulta');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <Text size="sm" tone="secondary">
        {t.endHint}
      </Text>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className={styles.confirm}>
          <Text ref={confirmHeading} tabIndex={-1} weight="medium">
            {interpolate(t.endConfirmTitle, { name })}
          </Text>
          <Text size="sm" tone="secondary">
            {t.endConfirmBody}
          </Text>
          <div className={styles.actions}>
            <Button loading={pending} onClick={() => void end()} type="button" variant="destructive">
              {t.endConfirmCta}
            </Button>
            <Button disabled={pending} onClick={() => setConfirming(false)} type="button" variant="secondary">
              {dictionary.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button onClick={() => setConfirming(true)} ref={trigger} type="button" variant="secondary">
            {t.end}
          </Button>
        </div>
      )}
    </div>
  );
}
