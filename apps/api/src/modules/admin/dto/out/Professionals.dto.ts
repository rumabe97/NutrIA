import type { BadgeCodeIssuedView, BadgeQueueView, BadgeRecordView, ProfessionalAccountView } from 'core/controllers/Professional';

/**
 * One professional as the owner sees them: the account, the number, the date
 * and their links counted per status — never a client's identity (`0028`).
 * The same shape answers a grant, so the screen adds the row it just made.
 */
export type ProfessionalAccountDto = ProfessionalAccountView;

/** Every professional, most recently granted first. */
export type ProfessionalsDto = readonly ProfessionalAccountView[];

/**
 * One practitioner's badge record as the console reads it (project 025): the
 * application with the declared register and number, the badge that stands,
 * the code out, and every check. Never a client, never a contact a code went to.
 */
export type BadgeRecordDto = BadgeRecordView;

/** The owner's badge list: applications waiting, and badges due for their yearly re-check. */
export type BadgeQueueDto = BadgeQueueView;

/** A code just issued: the code itself only for a letter or a call, once; by e-mail, whether the mail left. */
export type BadgeCodeIssuedDto = BadgeCodeIssuedView;
