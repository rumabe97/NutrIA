import type { AdminGenerationStatsView, AdminGenerationsView, AdminGenerationView } from 'core/controllers/Admin';

/**
 * One generation with the account that asked and every model call it made
 * (`0050`). An address is the only thing of theirs it carries (`0028`).
 */
export type AdminGenerationDto = AdminGenerationView;

/** One page of the log — every row exactly as above — and how many generations match. */
export type AdminGenerationsDto = AdminGenerationsView;

/** Outcome per day, durations per day and failures by code over a period. Counts and durations; nobody's address. */
export type AdminGenerationStatsDto = AdminGenerationStatsView;
