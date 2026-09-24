'use client';
import { useSyncExternalStore } from 'react';

import styles from './PlanPendingNotice.module.css';

import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';

import { isPendingReview } from 'lib/pendingReview';

interface PlanPendingNoticeProps {
  body: string;
  /** The screen's own active-plan id (or null) — what the mark is checked against. */
  currentPlanId: string | null;
  /**
   * Render the title as a heading. Default `true` (`/inicio`, where the notice
   * sits below the page's own `<h1>`). Pass `false` on `/plan`, where the
   * plan-exists branch's `<h1>` lives inside `PlanBrowser`, rendered *after*
   * this notice — an `<h2>` here would land before the page's only `<h1>` in
   * the heading outline. `role="status"` still gets the title announced live
   * either way; it does not need to be a heading to be read out.
   */
  heading?: boolean;
  title: string;
}

/** Nothing to subscribe to — the mark only ever changes from this same read. */
function noSubscription(): () => void {
  return () => {};
}

function alwaysAbsent(): boolean {
  return false;
}

/**
 * "Your plan is with your dietitian" (Phase 5's job route, `0060`) — read
 * through `useSyncExternalStore` rather than an effect, because the mark
 * lives in this browser's storage and the server rendering this page has no
 * way to know it: `getServerSnapshot` answers `false`, so the first paint
 * matches the server's and nothing server-rendered claims a wait the API
 * never confirmed.
 */
export function PlanPendingNotice({ body, currentPlanId, heading = true, title }: PlanPendingNoticeProps) {
  const pending = useSyncExternalStore(noSubscription, () => isPendingReview(currentPlanId), alwaysAbsent);

  if (!pending) {
    return null;
  }

  return (
    <Card as="section" className={styles.notice} role="status">
      {heading ? (
        <h2 className={styles.title}>{title}</h2>
      ) : (
        <Text as="strong" className={styles.title} weight="bold">
          {title}
        </Text>
      )}
      <Text size="sm" tone="secondary">
        {body}
      </Text>
    </Card>
  );
}
