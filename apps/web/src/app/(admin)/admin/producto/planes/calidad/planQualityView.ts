import type { AdminPlanQualityFullView, AdminPlanQualityView } from 'core/controllers/Admin';

/**
 * The counts, or null when the page must say "pocos datos" and nothing else. While
 * `fewData` the API sends no quality count at all (`0028`: too few plans could be one
 * person's), so the page narrows on it once and reads the full view from then on.
 */
export function readCounts(view: AdminPlanQualityView): AdminPlanQualityFullView | null {
  return view.fewData ? null : view;
}
