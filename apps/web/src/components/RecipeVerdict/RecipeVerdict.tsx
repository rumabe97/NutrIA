'use client';
import { useState } from 'react';

import styles from './RecipeVerdict.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api } from 'lib/api';

import type { RecipeVerdict as Verdict } from 'core/entities/Plan';

type Standing = 'disliked' | 'liked' | null;

interface RecipeVerdictProps {
  recipeId: string;
  verdict: Standing;
}

/**
 * Two buttons and one honest line about what pressing them does.
 *
 * Optimistic, like the shopping tick: the press lands before the request does,
 * and a failure puts it back. Pressing the active one withdraws the verdict —
 * a person changes their mind, and "none" is a state the API accepts for that.
 * The verdict is on the *recipe*, not this meal, because the dish can return in
 * another plan, and that is exactly what the verdict is about.
 */
export function RecipeVerdict({ recipeId, verdict: initial }: RecipeVerdictProps) {
  const t = useDictionary().meal;
  const [verdict, setVerdict] = useState<Standing>(initial);
  const [pending, setPending] = useState(false);

  async function choose(next: 'disliked' | 'liked') {
    const previous = verdict;
    const target: Verdict = verdict === next ? 'none' : next;

    setVerdict(target === 'none' ? null : target);
    setPending(true);

    try {
      await api(`/recipes/${recipeId}/verdict`, { body: { verdict: target }, method: 'PUT' });
    } catch {
      setVerdict(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.buttons}>
        <Button
          aria-pressed={verdict === 'liked'}
          disabled={pending}
          onClick={() => void choose('liked')}
          size="sm"
          type="button"
          variant={verdict === 'liked' ? 'primary' : 'secondary'}
        >
          {t.like}
        </Button>
        <Button
          aria-pressed={verdict === 'disliked'}
          disabled={pending}
          onClick={() => void choose('disliked')}
          size="sm"
          type="button"
          variant={verdict === 'disliked' ? 'primary' : 'secondary'}
        >
          {t.dislike}
        </Button>
      </div>
      <Text as="p" className={styles.hint} size="xs" tone="tertiary">
        {verdict === 'liked' ? t.likedHint : verdict === 'disliked' ? t.dislikedHint : t.verdictHint}
      </Text>
    </div>
  );
}
