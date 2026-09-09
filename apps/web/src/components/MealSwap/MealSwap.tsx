'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './MealSwap.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, ApiError, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

interface MealSwapProps {
  limit: number;
  mealId: string;
  remaining: number;
}

/**
 * "Change this dish", with the count of what is left said before the press.
 *
 * The button holds its spinner until the page has re-rendered with the new dish:
 * the swap updates the meal in place, so the same URL shows the result, and a
 * refresh is the whole navigation. Errors stay on this line — a spent allowance
 * and "nothing fits right now" are answers, not failures.
 */
export function MealSwap({ limit, mealId, remaining }: MealSwapProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.meal;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [left, setLeft] = useState(remaining);

  async function swap() {
    setError(undefined);
    setPending(true);

    try {
      await api(`/meal-plans/meals/${mealId}/swap`, { method: 'POST' });
      setLeft(count => Math.max(count - 1, 0));
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'QUOTA_EXCEEDED') {
        setLeft(0);
      } else if (caught instanceof ApiError && caught.code === 'CONFLICT') {
        setError(t.swapNoFit);
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  const hint = left <= 0 ? interpolate(t.swapSpent, { limit }) : left === 1 ? interpolate(t.swapHintOne, { limit }) : interpolate(t.swapHint, { limit, remaining: left });

  return (
    <div className={styles.root}>
      <Button disabled={left <= 0 || pending} loading={pending} onClick={() => void swap()} size="sm" type="button" variant="secondary">
        {pending ? t.swapping : t.swap}
      </Button>
      <Text as="p" className={styles.hint} size="xs" tone={error ? 'secondary' : 'tertiary'}>
        {error ?? hint}
      </Text>
    </div>
  );
}
