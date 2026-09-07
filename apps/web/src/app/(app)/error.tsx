'use client';
import { useEffect } from 'react';

import styles from './error.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';

/**
 * Catches a failed render in any signed-in route.
 *
 * Without a boundary here, a server component that throws replaces the whole app
 * with Next's default error page. `reset()` re-runs the segment, which is usually
 * all a transient API failure needs.
 *
 * The message is deliberately plain: `error.message` from a server component is
 * redacted in production anyway, and showing a digest to someone who wanted dinner
 * helps nobody.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dictionary = useDictionary();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>{dictionary.errors.boundaryTitle}</h1>
      <Text tone="secondary">{dictionary.errors.boundaryBody}</Text>

      <div className={styles.actions}>
        <Button onClick={reset} type="button">
          {dictionary.common.retry}
        </Button>
        <CtaLink href="/inicio" variant="secondary">
          {dictionary.errors.boundaryHome}
        </CtaLink>
      </div>
    </div>
  );
}
