import { z } from 'zod';

/**
 * The version of `/condiciones` an account accepted when it was created
 * (`0071`, project 008 phase 7; `docs/legal/2026-09-29-aceptacion-de-los-textos-legales.md`
 * § 5). The server writes it, in the same `INSERT` that creates the account —
 * for email, Google and Apple alike — and no request can send it.
 *
 * `1.x` is the three texts of 21, 25 and 28 September, which were never
 * recorded; `2.0.0` is the first that is.
 *
 * **The bump rule:** any change of meaning in the `terms` dictionary, in
 * `es-ES.ts` or in `en-GB.ts`, bumps this constant **and** `terms.updated` in
 * the same commit. A typo fix bumps neither. Stored `null` means the account
 * was created before this was recorded — never a version to fill in.
 *
 * Only `/condiciones` is recorded: the privacy policy is informed, never
 * accepted, and has no version here.
 */
export const TERMS_VERSION = '2.0.0';

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
  /** When a sign-in found the password in the breach corpus (PLAN 011 phase 2); null while it is not known to be. */
  passwordCompromisedAt: z.date().nullable(),
  role: z.enum(['user', 'admin']),
  tier: z.enum(['free', 'premium']),
  updatedAt: z.date()
});

export type User = z.infer<typeof userSchema>;
export type UserRole = User['role'];
export type UserTier = User['tier'];
