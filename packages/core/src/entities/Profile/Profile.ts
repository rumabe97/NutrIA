import { z } from 'zod';

export const profileSchema = z.object({
  id: z.string().uuid(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  updatedAt: z.date(),
  userId: z.string().uuid(),
  username: z.string().min(3).max(50)
});

export type Profile = z.infer<typeof profileSchema>;

// omit() removes server-generated fields from the creation input shape.
export const createProfileSchema = profileSchema.omit({ id: true, updatedAt: true });
export type CreateProfile = z.infer<typeof createProfileSchema>;

// userId is immutable after creation — exclude it from update input.
export const updateProfileSchema = profileSchema.omit({ id: true, updatedAt: true, userId: true }).partial();
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
