import { z } from 'zod';

/**
 * The authenticated account. Better Auth owns this row, so the shape mirrors
 * its table (see `packages/database/src/schemas/auth.schema.ts`) plus the `role`
 * column we add.
 *
 * `id` is a string, not a UUID: Better Auth generates its own ids and they are
 * not UUID-shaped. Validating them as UUIDs would reject every real user.
 *
 * `activatedAt` is ours, not Better Auth's: the moment the owner opened the
 * account (`0030`). Null means waiting, whatever the address says.
 */
export const userSchema = z.object({
  id: z.string().min(1),
  activatedAt: z.date().nullable(),
  createdAt: z.date(),
  email: z.email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin']),
  updatedAt: z.date()
});

export type User = z.infer<typeof userSchema>;
export type UserRole = User['role'];
