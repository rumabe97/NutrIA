import type { ProfessionalAccountView } from 'core/controllers/Professional';

/**
 * One professional as the owner sees them: the account, the number, the date
 * and their links counted per status — never a client's identity (`0028`).
 * The same shape answers a grant, so the screen adds the row it just made.
 */
export type ProfessionalAccountDto = ProfessionalAccountView;

/** Every professional, most recently granted first. */
export type ProfessionalsDto = readonly ProfessionalAccountView[];
