import type { AiUsageView } from 'core/controllers/Admin';

/**
 * Our count of what left this service, against a limit the operator configured.
 * Deliberately not the provider's number — there is no endpoint to read (`0035`).
 */
export type AiUsageDto = AiUsageView;
