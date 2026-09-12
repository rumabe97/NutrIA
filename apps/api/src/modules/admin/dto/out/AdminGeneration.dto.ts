import type { AdminGenerationView } from 'core/controllers/Admin';

/**
 * One generation with the account that asked and every model call it made
 * (`0050`). An address is the only thing of theirs it carries (`0028`).
 */
export type AdminGenerationDto = AdminGenerationView;
