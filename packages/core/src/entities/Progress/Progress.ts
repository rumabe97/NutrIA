import { z } from 'zod';

/** The same bounds the onboarding weight field uses, so one figure cannot be valid in one place and not the other. */
export const WEIGHT_KG = { max: 400, min: 30 } as const;

export const progressEntrySchema = z.object({ id: z.uuid(), loggedOn: z.string(), weightKg: z.number().nullable() });

export type ProgressEntry = z.infer<typeof progressEntrySchema>;

/**
 * One weight, on one day.
 *
 * `loggedOn` rather than a timestamp: a weight belongs to a morning, not to a
 * moment, and two readings on the same day are a correction rather than a trend.
 * Logging the same day twice replaces the earlier figure.
 */
export const logWeightSchema = z.object({ loggedOn: z.iso.date().optional(), weightKg: z.number().min(WEIGHT_KG.min).max(WEIGHT_KG.max) });

export type LogWeight = z.infer<typeof logWeightSchema>;
