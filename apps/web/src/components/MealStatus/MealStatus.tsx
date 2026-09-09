'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './MealStatus.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api } from 'lib/api';

import type { MealStatus as Status } from 'core/entities/Plan';

interface MealStatusProps {
  mealId: string;
  status: Status;
}

/**
 * Eaten, or skipped — two presses, and the active one withdraws itself.
 *
 * Optimistic like the verdict: the answer lands before the request does and a
 * failure puts it back. The page is refreshed afterwards because other things
 * on it follow the status — a swap is only offered on a meal still to come.
 */
export function MealStatus({ mealId, status: initial }: MealStatusProps) {
  const router = useRouter();
  const t = useDictionary().meal;
  const [status, setStatus] = useState<Status>(initial);
  const [pending, setPending] = useState(false);

  async function choose(next: 'completed' | 'skipped') {
    const previous = status;
    const target: Status = status === next ? 'planned' : next;

    setStatus(target);
    setPending(true);

    try {
      await api(`/meal-plans/meals/${mealId}/status`, { body: { status: target }, method: 'PATCH' });
      router.refresh();
    } catch {
      setStatus(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.buttons}>
        <Button
          aria-pressed={status === 'completed'}
          disabled={pending}
          onClick={() => void choose('completed')}
          size="sm"
          type="button"
          variant={status === 'completed' ? 'primary' : 'secondary'}
        >
          {t.done}
        </Button>
        <Button
          aria-pressed={status === 'skipped'}
          disabled={pending}
          onClick={() => void choose('skipped')}
          size="sm"
          type="button"
          variant={status === 'skipped' ? 'primary' : 'secondary'}
        >
          {t.skipped}
        </Button>
      </div>
      <Text as="p" className={styles.hint} size="xs" tone="tertiary">
        {status === 'completed' ? t.doneHint : status === 'skipped' ? t.skippedHint : t.statusHint}
      </Text>
    </div>
  );
}
