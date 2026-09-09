import { z } from 'zod';

/** The only switch there is, so the body is one boolean and nothing else. */
export const adminSettingsSchema = z.object({ registrationOpen: z.boolean() });

export type AdminSettings = z.infer<typeof adminSettingsSchema>;
