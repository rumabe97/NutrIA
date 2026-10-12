import { z } from 'zod';

import { ALLOWANCE_NAMES } from 'core/domain/Allowance';
import { FLAG_NAMES } from 'core/domain/Flag';

import type { FlagName } from 'core/domain/Flag';

/**
 * Throwing one switch: which, and which way.
 *
 * The names come from the registry rather than being spelled again here, so a
 * flag added there is accepted by the route without a second edit — and, more
 * to the point, a flag *removed* there stops being accepted, instead of leaving
 * a route that writes a row nothing reads.
 */
export const setFlagSchema = z.object({ enabled: z.boolean(), flag: z.enum(FLAG_NAMES as [FlagName, ...FlagName[]]) });

export type SetFlag = z.infer<typeof setFlagSchema>;

/**
 * Moving one limit for one tier from the console (`0097`).
 *
 * The shape is checked here; whether the number is allowed is checked against
 * the registry's bounds in the controller, because the bounds differ per limit
 * and the answer must be the same one the resolution reads. Whole numbers only:
 * two and a half swaps is not a smaller allowance, it is a typo, and a clamp
 * would turn it into a number nobody chose.
 */
export const setAllowanceSchema = z.object({ name: z.enum(ALLOWANCE_NAMES), tier: z.enum(['free', 'premium']), value: z.number().int().min(0) });

export type SetAllowance = z.infer<typeof setAllowanceSchema>;

/** Moving one account between tiers (`0042`). The owner's decision, so the body is only the destination. */
export const setTierSchema = z.object({ tier: z.enum(['free', 'premium']) });

export type SetTier = z.infer<typeof setTierSchema>;
