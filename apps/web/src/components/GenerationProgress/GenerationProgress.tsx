'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './GenerationProgress.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';
import { EventPlanner } from 'components/EventPlanner';

import { api, ApiError, messageFor } from 'lib/api';
import { formatDate, interpolate } from 'lib/format';
import { generationError, stepLabel } from 'lib/generation';

import type { EventAllowance } from 'components/EventPlanner';
import type { EventView } from 'core/controllers/Event';
import type { JobView } from 'core/controllers/Plan';

/**
 * Polling backs off: 1 s, 2 s, 4 s, then every 6 s. The first answers arrive
 * while the job is still queued and change quickly; once it is generating, a
 * plan takes minutes and nothing changes second to second. A fifth of the
 * requests the old fixed 1.5 s made, and no slower to notice the end.
 */
const POLL_DELAYS_MS = [1000, 2000, 4000] as const;
const POLL_MAX_MS = 6000;
/** Ten minutes at the capped interval; the job itself gives up well before. */
const MAX_POLLS = 100;

function pollDelay(poll: number): number {
  return POLL_DELAYS_MS[poll] ?? POLL_MAX_MS;
}

type Phase =
  | { code: string | null; detail: string | null; kind: 'failed' }
  | { kind: 'ready' }
  | { kind: 'running'; step: string | null }
  | { kind: 'starting' };

interface GenerationProgressProps {
  /** What is left of the events cap, or `null` while the API does not say — see `EventAllowance`. */
  allowance: EventAllowance | null;
  /** The upcoming events, shown before the job starts so the plan is built with them. */
  events: readonly EventView[];
}

/**
 * Asks once, then starts a generation and follows it.
 *
 * The screen no longer starts the job on arrival. An event is read when the
 * fortnight is laid out (`0043`), so the moment before the job exists is the
 * one moment adding one costs nothing — after it, the price is a redo. The
 * ready branch shows what will shape this plan and a form to add to it; the
 * form leaves with that branch, because a control that changes nothing is
 * worse than no control.
 *
 * The label shown is `job.step`, written by the pipeline **before** each stage
 * begins — so it is never a stage the server did not reach, and there is no timed
 * script of reassuring messages (PRD criterion 8). The bar is indeterminate for
 * the same reason: the pipeline reports stages, not a percentage.
 */
export function GenerationProgress({ allowance, events }: GenerationProgressProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const [fatal, setFatal] = useState<string>();

  async function start() {
    setFatal(undefined);
    setPhase({ kind: 'starting' });

    let job: JobView;

    try {
      job = await api<JobView>('/meal-plans/generate', { method: 'POST' });
    } catch (error) {
      // 429 is the generation limit, not a failure of the plan itself.
      setFatal(
        error instanceof ApiError && error.code === 'QUOTA_EXCEEDED'
          ? interpolate(dictionary.generation.quotaExceeded, {
              date: error.retryAt ? formatDate(error.retryAt, locale, { day: 'numeric', month: 'long' }) : ''
            })
          : error instanceof ApiError && error.status === 429
            ? dictionary.generation.rateLimited
            : messageFor(error, dictionary)
      );

      return;
    }

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      await new Promise(resolve => setTimeout(resolve, pollDelay(poll)));

      let current: JobView;

      try {
        current = await api<JobView>(`/meal-plans/jobs/${job.id}`);
      } catch {
        continue;
      }

      if (current.status === 'succeeded') {
        router.push('/plan');
        router.refresh();

        return;
      }

      if (current.status === 'failed') {
        setPhase({ code: current.error, detail: current.errorDetail, kind: 'failed' });

        return;
      }

      setPhase({ kind: 'running', step: current.step });
    }

    setPhase({ code: 'GENERATION_ABANDONED', detail: null, kind: 'failed' });
  }

  if (fatal) {
    return (
      <div className={styles.shell}>
        <h1 className={styles.title}>{dictionary.generation.couldNotStart}</h1>
        <p className={styles.error} role="alert">
          {fatal}
        </p>
        <div className={styles.actions}>
          <Button onClick={() => void start()} type="button">
            {dictionary.common.retry}
          </Button>
          <CtaLink href="/inicio" variant="secondary">
            {dictionary.generation.back}
          </CtaLink>
        </div>
      </div>
    );
  }

  if (phase.kind === 'failed') {
    const copy = generationError(phase.code, dictionary);

    return (
      <div className={styles.shell}>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.error} role="alert">
          {copy.body}
        </p>

        {/* The provider's own words, already redacted server-side. This product is
            self-hosted — whoever sees this screen is also whoever can fix it, so
            hiding the actual reason helps nobody. */}
        {phase.detail ? (
          <p className={styles.detail}>
            <strong>{dictionary.generation.serverDetail}</strong> {phase.detail}
          </p>
        ) : null}
        <div className={styles.actions}>
          {copy.canRetry ? (
            <Button onClick={() => void start()} type="button">
              {dictionary.common.retry}
            </Button>
          ) : (
            <CtaLink href="/onboarding">{dictionary.generation.completeProfile}</CtaLink>
          )}
          <CtaLink href="/inicio" variant="secondary">
            {dictionary.generation.back}
          </CtaLink>
        </div>
      </div>
    );
  }

  if (phase.kind === 'ready') {
    return (
      <div className={styles.shell}>
        <h1 className={styles.title}>{dictionary.generation.readyTitle}</h1>
        <Text tone="secondary">{dictionary.generation.readyBody}</Text>

        {/* Only here, before the job exists. Once it is out, an event added
            would not be in the plan being built — the form goes with this
            branch rather than staying as a control that does nothing. */}
        <div className={styles.before}>
          <EventPlanner allowance={allowance} events={events} variant="generation" />
        </div>

        <div className={styles.actions}>
          <Button onClick={() => void start()} size="lg" type="button">
            {dictionary.generation.start}
          </Button>
          <CtaLink href="/inicio" size="lg" variant="secondary">
            {dictionary.generation.back}
          </CtaLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>{dictionary.generation.title}</h1>
      <Text tone="secondary">{dictionary.generation.wait}</Text>

      <div aria-atomic="true" aria-live="polite" className={styles.step}>
        <Text weight="medium">{phase.kind === 'running' && phase.step ? stepLabel(phase.step, dictionary) : dictionary.generation.starting}</Text>
      </div>

      <div className={styles.track}>
        <div className={styles.bar} />
      </div>

      <Text className={styles.note} size="sm" tone="tertiary">
        {dictionary.generation.safetyNote}
      </Text>
    </div>
  );
}
