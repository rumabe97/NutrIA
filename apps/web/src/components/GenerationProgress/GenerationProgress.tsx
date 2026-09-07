'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './GenerationProgress.module.css';

import { Button } from 'ui/components/Button';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';

import { api, ApiError, messageFor } from 'lib/api';
import { generationError } from 'lib/generation';

import type { JobView } from 'core/controllers/Plan';

const POLL_MS = 1500;
/** Generation takes a couple of minutes at worst; beyond this something is wrong. */
const MAX_POLLS = 240;

type Phase = { code: string | null; detail: string | null; kind: 'failed' } | { kind: 'running'; step: string | null } | { kind: 'starting' };

/**
 * Starts a generation and follows it.
 *
 * The label shown is `job.step`, written by the pipeline **before** each stage
 * begins — so it is never a stage the server did not reach, and there is no timed
 * script of reassuring messages (PRD criterion 8). The bar is indeterminate for
 * the same reason: the pipeline reports stages, not a percentage.
 */
export function GenerationProgress() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [fatal, setFatal] = useState<string>();
  const started = useRef(false);

  const start = useCallback(async () => {
    setFatal(undefined);
    setPhase({ kind: 'starting' });

    let job: JobView;

    try {
      job = await api<JobView>('/meal-plans/generate', { method: 'POST' });
    } catch (error) {
      // 429 is the generation limit, not a failure of the plan itself.
      setFatal(error instanceof ApiError && error.status === 429 ? 'Has pedido varios planes seguidos. Espera un momento antes de volver a intentarlo.' : messageFor(error));

      return;
    }

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      await new Promise(resolve => setTimeout(resolve, POLL_MS));

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
  }, [router]);

  useEffect(() => {
    // React 18+ mounts effects twice in development; without this the user would
    // burn two of their three hourly generations on one visit.
    if (started.current) {return;}

    started.current = true;
    void start();
  }, [start]);

  if (fatal) {
    return (
      <div className={styles.shell}>
        <h1 className={styles.title}>No hemos podido empezar</h1>
        <p className={styles.error}>{fatal}</p>
        <div className={styles.actions}>
          <Button onClick={() => void start()} type="button">
            Reintentar
          </Button>
          <CtaLink href="/inicio" variant="secondary">
            Volver
          </CtaLink>
        </div>
      </div>
    );
  }

  if (phase.kind === 'failed') {
    const copy = generationError(phase.code);

    return (
      <div className={styles.shell}>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.error}>{copy.body}</p>

        {/* The provider's own words, already redacted server-side. This product is
            self-hosted — whoever sees this screen is also whoever can fix it, so
            hiding the actual reason helps nobody. */}
        {phase.detail ? (
          <p className={styles.detail}>
            <strong>Detalle del servidor:</strong> {phase.detail}
          </p>
        ) : null}
        <div className={styles.actions}>
          {copy.canRetry ? (
            <Button onClick={() => void start()} type="button">
              Reintentar
            </Button>
          ) : (
            <CtaLink href="/onboarding/1">Completar mi perfil</CtaLink>
          )}
          <CtaLink href="/inicio" variant="secondary">
            Volver
          </CtaLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
        <h1 className={styles.title}>Estamos creando tu plan</h1>
        <Text tone="secondary">Tarda un par de minutos. Puedes dejar esta página abierta.</Text>

        <div aria-atomic="true" aria-live="polite" className={styles.step}>
          <Text weight="medium">{phase.kind === 'running' && phase.step ? phase.step : 'Empezando…'}</Text>
        </div>

        <div className={styles.track}>
          <div className={styles.bar} />
        </div>

        <Text className={styles.note} size="sm" tone="tertiary">
          Comprobamos tus alergias antes de guardar nada.
        </Text>
      </div>
  );
}
