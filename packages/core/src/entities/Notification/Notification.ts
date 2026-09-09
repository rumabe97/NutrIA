import { z } from 'zod';

/**
 * The one thing a person can say about the mail this product sends: whether
 * they want it. One kind, one channel — a reminder that cannot be turned off is
 * not a reminder, it is spam, and the switch ships with the first mail rather
 * than after the complaints.
 */
export const setNotificationSettingsSchema = z.object({ checkInEmail: z.boolean() });

export type SetNotificationSettings = z.infer<typeof setNotificationSettingsSchema>;
