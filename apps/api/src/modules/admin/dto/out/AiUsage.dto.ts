import type { AdminAiView } from 'core/controllers/Admin';

/**
 * Our count of what left this service today, against a limit the operator
 * configured — deliberately not the provider's number, there is no endpoint to
 * read (`0035`) — and the period's: totals against the period before, calls
 * and tokens per day, and calls by model (`0068`).
 */
export type AdminAiDto = AdminAiView;
