const KEY = 'nutria:pendingReview';

interface PendingReviewMark {
  /**
   * The active plan's id at the moment the mark was set, or null when there
   * was none. Once the professional publishes, the active plan's id changes
   * (or a null becomes one) — that is the only client-visible sign the wait
   * is over, so the mark is read against it rather than carrying an
   * expiry of its own.
   */
  previousPlanId: string | null;
}

/**
 * There is no field on anything a client reads that says "your plan is
 * waiting for your dietitian" — `GET /care/links/me` and `GET
 * /meal-plans/active` answer exactly as they would for an unlinked client
 * with no new plan (Phase 8's brief, confirmed against `PlanController` and
 * the `care-review.e2e-spec.ts` suite). The **one** moment the client is ever
 * told is `JobView.pendingReview`, right after their own generation succeeds
 * (`core/controllers/Plan`, `presentJob`). This remembers that moment across
 * reloads, in this browser only, so the calm notice on `/inicio` and `/plan`
 * survives a refresh — and clears itself once the active plan's id no longer
 * matches what it was when the mark was set, which is what a publish changes.
 *
 * Not sensitive: a boolean and a plan id, nothing about health or diet.
 */
export function markPendingReview(previousPlanId: string | null): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ previousPlanId } satisfies PendingReviewMark));
  } catch {
    // Private browsing, storage disabled — the notice simply will not
    // survive a reload. Nothing else depends on it.
  }
}

/** Whether the mark set by `markPendingReview` still applies to `currentPlanId`. */
export function isPendingReview(currentPlanId: string | null): boolean {
  try {
    const raw = localStorage.getItem(KEY);

    if (!raw) {
      return false;
    }

    const mark = JSON.parse(raw) as PendingReviewMark;

    if (mark.previousPlanId !== currentPlanId) {
      localStorage.removeItem(KEY);

      return false;
    }

    return true;
  } catch {
    return false;
  }
}
