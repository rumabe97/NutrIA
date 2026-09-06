import { z } from 'zod';

export const userSchema = z.object({ id: z.string().uuid(), createdAt: z.date(), email: z.string().email(), name: z.string().min(1).max(100) });

export type User = z.infer<typeof userSchema>;

// omit() removes server-generated fields from the creation input shape.
export const createUserSchema = userSchema.omit({ id: true, createdAt: true });
export type CreateUser = z.infer<typeof createUserSchema>;
