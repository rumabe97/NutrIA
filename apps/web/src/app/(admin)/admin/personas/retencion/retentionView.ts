import type { AdminRetentionView } from 'core/controllers/Admin';

/**
 * The retention view as the page reads it: a cohort's size and any cell may be null.
 *
 * The API may suppress a small cohort's size or cell later (`0028`); the page shows
 * "—" for a null. The controller's own view is assignable to this one, so nothing
 * changes here on that day.
 */
export type RetentionCellView = {
  readonly active: number | null;
  readonly eligible: number | null;
  readonly enough: boolean;
  readonly weeks: number;
} | null;

export type RetentionCohortView = { readonly cells: readonly RetentionCellView[]; readonly size: number | null; readonly start: string };

export type RetentionPageView = Omit<AdminRetentionView, 'didSomething' | 'usedTheApp'> & {
  readonly didSomething: readonly RetentionCohortView[];
  readonly usedTheApp: readonly RetentionCohortView[];
};
