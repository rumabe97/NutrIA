import type { AdminGenerationStatsView, AdminGenerationsView } from 'core/controllers/Admin';

/** One page of the log — every row with the account that asked and every model call it made, an address the only thing of theirs it carries (`0028`, `0050`) — and how many generations match. */
export type AdminGenerationsDto = AdminGenerationsView;

/** Outcome per day, durations per day and failures by code over a period. Counts and durations; nobody's address. */
export type AdminGenerationStatsDto = AdminGenerationStatsView;
