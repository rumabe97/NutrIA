import { liftRestrictionSchema, restrictPracticeSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The owner's statement of reasons for a suspension or a close (`docs/legal/textos/06`
 * § W bis.1): the facts, the section of the agreement read with its § 13, the
 * source, and the authority when it is one. Never a date: a close always runs
 * its 30 days.
 */
export const RestrictPracticeDto = zodDto('RestrictPractice', restrictPracticeSchema);
export type RestrictPracticeDto = InferDto<typeof RestrictPracticeDto>;

/** Lifting what stands (§ W bis.2), with what the owner found, or nothing. */
export const LiftRestrictionDto = zodDto('LiftRestriction', liftRestrictionSchema);
export type LiftRestrictionDto = InferDto<typeof LiftRestrictionDto>;
