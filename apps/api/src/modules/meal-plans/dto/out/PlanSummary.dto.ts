import type { PlanSummaryView } from 'core/controllers/Plan';

/** One line of history, with `replaced` saying whether a later plan overtook it (`0021`). */
export type PlanSummaryDto = PlanSummaryView;
