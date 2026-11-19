'use client';
import { useSyncExternalStore } from 'react';

import styles from './PlanPendingNotice.module.css';

import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { isPendingReview } from 'lib/pendingReview';
import { withProfessional } from 'lib/professionalName';

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
  /** The linked practitioner's name as the API may show it (`CareLinkView.professionalName`); null or absent: «tu profesional». */
  professionalName?: string | null;
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
export function PlanPendingNotice({ body, currentPlanId, heading = true, professionalName = null, title }: PlanPendingNoticeProps) {
  const dictionary = useDictionary();
  const pending = useSyncExternalStore(noSubscription, () => isPendingReview(currentPlanId), alwaysAbsent);

  if (!pending) {
    return null;
  }

  // The practitioner by the name the API judged, or «tu profesional» when it may not be shown
  // (PRD 025 criterion 19) — never «tu dietista», whatever the tier.
  const named = (text: string) => withProfessional(text, professionalName, dictionary.care.professionalUnnamed);

  return (
    <Note as="section" role="status" toneLabel={dictionary.common.noteTone.info}>
      {heading ? (
        <h2 className={styles.title}>{named(title)}</h2>
      ) : (
        <Text as="strong" className={styles.title} weight="bold">
          {named(title)}
        </Text>
      )}
      <Text size="sm" tone="secondary">
        {named(body)}
      </Text>
    </Note>
  );
}
