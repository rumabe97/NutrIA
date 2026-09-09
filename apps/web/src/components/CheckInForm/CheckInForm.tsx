'use client';
import { useState } from 'react';

import styles from './CheckInForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';
import { OptionCards } from 'components/OptionCards';

import { api, ApiError, messageFor } from 'lib/api';
import { formatNumber, interpolate } from 'lib/format';

import type { CheckInResultView } from 'core/controllers/CheckIn';
import type { FormEvent } from 'react';

interface CheckInFormProps {
  latestKg: number | null;
  planEnded: boolean;
  planId: string;
}

/**
 * Five questions and one honest confirmation of what they changed. Uncontrolled
 * like the onboarding: the form is the state, read once on submit. The
 * confirmation names each effect — weight logged, target moved from/to — so
 * nobody has to trust that "we will take it into account" meant anything.
 */
export function CheckInForm({ latestKg, planEnded, planId }: CheckInFormProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.checkIn;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, readonly string[]>>({});
  const [result, setResult] = useState<CheckInResultView>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setFieldErrors({});
    setPending(true);

    const form = new FormData(event.currentTarget);
    const weight = String(form.get('weightKg') ?? '').replace(',', '.');
    const body = {
      comments: String(form.get('comments') ?? '').trim() || undefined,
      difficulty: String(form.get('difficulty') ?? 'ok'),
      hunger: String(form.get('hunger') ?? 'right'),
      planId,
      satisfaction: Number(form.get('satisfaction') ?? 3),
      weightKg: weight === '' ? null : Number(weight)
    };

    try {
      setResult(await api<CheckInResultView>('/check-ins', { body, method: 'POST' }));
    } catch (caught) {
      if (caught instanceof ApiError) {setFieldErrors(caught.fieldErrors);}

      setError(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <section className={styles.done}>
        <h2 className={styles.doneTitle}>{t.doneTitle}</h2>
        <Text tone="secondary">{t.doneBody}</Text>
        <ul className={styles.effects}>
          {result.weightLogged ? <li>{t.doneWeight}</li> : null}
          <li>{result.targets ? interpolate(t.doneTargets, { from: formatNumber(result.targets.fromKcal, locale), to: formatNumber(result.targets.toKcal, locale) }) : t.doneNoTargets}</li>
          <li>{t.doneWords}</li>
        </ul>
        <div className={styles.actions}>
          {planEnded ? (
            <CtaLink href="/plan/generando" size="lg">
              {t.nextPlan}
            </CtaLink>
          ) : null}
          <CtaLink href="/inicio" size="lg" variant={planEnded ? 'secondary' : 'primary'}>
            {t.backHome}
          </CtaLink>
        </div>
      </section>
    );
  }

  const hunger = [
    { label: t.hungerHungry, value: 'hungry' },
    { label: t.hungerRight, value: 'right' },
    { label: t.hungerTooMuch, value: 'too_much' }
  ];
  const difficulty = [
    { label: t.difficultyEasy, value: 'easy' },
    { label: t.difficultyOk, value: 'ok' },
    { label: t.difficultyHard, value: 'hard' }
  ];
  const satisfaction = [1, 2, 3, 4, 5].map(value => ({ label: String(value), value: String(value) }));

  return (
    <form className={styles.form} noValidate={true} onSubmit={onSubmit}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Input defaultValue={latestKg ?? ''} error={fieldErrors.weightKg?.[0]} hint={t.weightHint} label={t.weight} name="weightKg" step="0.1" type="number" />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.hunger}</legend>
        <OptionCards name="hunger" options={hunger} value="right" />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.difficulty}</legend>
        <OptionCards name="difficulty" options={difficulty} value="ok" />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.satisfaction}</legend>
        <OptionCards name="satisfaction" options={satisfaction} value="4" />
      </fieldset>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="check-in-comments">
          {t.comments}
        </label>
        <textarea className={styles.textarea} id="check-in-comments" maxLength={500} name="comments" rows={4} />
        <Text size="xs" tone="tertiary">
          {t.commentsHint}
        </Text>
      </div>

      <Button disabled={pending} loading={pending} size="lg" type="submit">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
