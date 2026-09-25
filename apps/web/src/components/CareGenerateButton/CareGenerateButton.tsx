'use client';
import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareGenerateButton.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, ApiError, messageFor } from 'lib/api';
import { formatDate, interpolate } from 'lib/format';
import { stepLabel } from 'lib/generation';

import type { JobView } from 'core/controllers/Plan';

/**
 * Slower than the client's own screen: every read of this job writes a row in
 * the client's trail, and a generation takes minutes. Quick while queued, then
 * every ten seconds — a third of the rows, and no slower to notice the end
 * than a person would.
 */
const POLL_DELAYS_MS = [2000, 4000] as const;
const POLL_MAX_MS = 10_000;
/** Ten minutes at the capped interval; the job itself gives up well before. */
const MAX_POLLS = 60;

interface CareGenerateButtonProps {
  /** Drawn but not pressable, with `hint` saying why — never a way round a running fortnight. */
  disabled?: boolean;
  /** One line under the button: what pressing it does, or why it cannot be pressed. */
  hint: string;
  label: string;
  linkId: string;
  variant?: 'primary' | 'secondary';
}

/** The plan under review's heading on the client's page, where a new pending plan is shown. */
const PENDING_HEADING = 'pending-title';

/** The failures the professional can do nothing about but wait for the client; everything else is worth another try. */
const INCOMPLETE = new Set(['GENERATION_ONBOARDING_INCOMPLETE', 'GENERATION_PROFILE_INCOMPLETE']);

type Phase =
  { kind: 'done'; pendingReview: boolean } | { kind: 'failed'; message: string } | { kind: 'idle' } | { kind: 'running'; step: string | null };

/**
 * Starts a generation for a client through their link and follows it to the
 * end (`POST /care/clients/:linkId/plan/generate`, then its job). The same
 * route makes the next fortnight and replaces the plan under review; which one
 * it does is the server's to decide from the client's plans, not this button's.
 *
 * On success the page is read again: the new plan is either waiting for review
 * or already the client's, and both are drawn by the server.
 */
export function CareGenerateButton({ disabled = false, hint, label, linkId, variant = 'primary' }: CareGenerateButtonProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.practice;
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const base = `/care/clients/${encodeURIComponent(linkId)}/plan`;
  const done = phase.kind === 'done';

  // *Nueva quincena* is disabled by its own success once a plan waits for review, and a control that gains
  // `disabled` loses focus to <body>. When the refreshed page arrives, focus goes to the plan it made.
  useEffect(() => {
    if (done && disabled) {
      document.getElementById(PENDING_HEADING)?.focus();
    }
  }, [disabled, done]);

  async function start() {
    setPhase({ kind: 'running', step: null });

    let job: JobView;

    try {
      job = await api<JobView>(`${base}/generate`, { method: 'POST' });
    } catch (caught) {
      setPhase({ kind: 'failed', message: refusal(caught) });

      return;
    }

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      await new Promise(resolve => setTimeout(resolve, POLL_DELAYS_MS[poll] ?? POLL_MAX_MS));

      let current: JobView;

      try {
        current = await api<JobView>(`${base}/jobs/${encodeURIComponent(job.id)}`);
      } catch (caught) {
        // The link ended or paused mid-generation: no amount of waiting brings the job back.
        if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
          setPhase({ kind: 'failed', message: t.gone });

          return;
        }

        continue;
      }

      if (current.status === 'succeeded') {
        router.refresh();
        // Said where the button is: the new plan appears elsewhere on the page, and a refresh announces nothing.
        setPhase({ kind: 'done', pendingReview: current.pendingReview });

        return;
      }

      if (current.status === 'failed') {
        // The client's own failure copy speaks to the client ("tus datos"); this reader is their professional.
        setPhase({ kind: 'failed', message: INCOMPLETE.has(current.error ?? '') ? t.generateIncomplete : t.generateFailed });

        return;
      }

      setPhase({ kind: 'running', step: current.step });
    }

    setPhase({ kind: 'failed', message: t.generateFailed });
  }

  function refusal(caught: unknown): string {
    if (caught instanceof ApiError && caught.code === 'QUOTA_EXCEEDED') {
      return interpolate(t.generateQuota, { date: caught.retryAt ? formatDate(caught.retryAt, locale, { day: 'numeric', month: 'long' }) : '' });
    }

    if (caught instanceof ApiError && caught.status === 429) {
      return dictionary.generation.rateLimited;
    }

    if (caught instanceof ApiError && caught.status === 409) {
      return t.generateBusy;
    }

    if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
      return t.gone;
    }

    return messageFor(caught, dictionary);
  }

  const running = phase.kind === 'running';

  return (
    <div className={styles.root}>
      <Button disabled={disabled} loading={running} onClick={() => void start()} type="button" variant={variant}>
        {label}
      </Button>

      {/* The pipeline's own step, written before each stage begins — never a timed script. */}
      {running ? (
        <Text as="p" className={styles.line} role="status" size="sm" tone="secondary">
          {phase.step ? stepLabel(phase.step, dictionary) : t.generating}
        </Text>
      ) : phase.kind === 'done' ? (
        <Text as="p" className={styles.line} key="done" role="status" size="sm" tone="secondary">
          {phase.pendingReview ? t.generateDoneReview : t.generateDoneDirect}
        </Text>
      ) : phase.kind === 'failed' ? (
        <p className={styles.error} role="alert">
          {phase.message}
        </p>
      ) : (
        <Text as="p" className={styles.line} size="xs" tone="tertiary">
          {hint}
        </Text>
      )}
    </div>
  );
}
