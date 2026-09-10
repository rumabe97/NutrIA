import { z } from 'zod';

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

/** Moving one account between tiers (`0042`). The owner's decision, so the body is only the destination. */
export const setTierSchema = z.object({ tier: z.enum(['free', 'premium']) });

export type SetTier = z.infer<typeof setTierSchema>;
