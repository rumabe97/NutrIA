import { z } from 'zod';

/**
 * What a collegiate number may look like: letters, digits, `/` and `-`, three
 * to twenty of them. Spanish registers write them as `MAD00123`, `CV-0456` or
 * `12/3456`, and nothing longer; anything else is a typo at the door, not a
 * different register.
 */
export const COLLEGIATE_NUMBER_PATTERN = /^[A-Za-z0-9/-]{3,20}$/;

/**
 * The owner's act (`0059`): the one body that can make an account a
 * professional, and it carries only the collegiate number. Required, never a
 * declaration — the owner types it from the register before granting.
 */
export const grantProfessionalSchema = z.object({ collegiateNumber: z.string().trim().regex(COLLEGIATE_NUMBER_PATTERN) });

export type GrantProfessional = z.infer<typeof grantProfessionalSchema>;

/**
 * The row as `professionals` holds it. `grantedBy` is another account's id —
 * the owner's — and is the one field no presenter may carry.
 */
export const professionalSchema = z.object({
  id: z.uuid(),
  collegiateNumber: z.string().min(1),
  createdAt: z.date(),
  grantedAt: z.date(),
  grantedBy: z.string().nullable(),
  includedClients: z.number().int().min(0),
  practiceOpen: z.boolean(),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type Professional = z.infer<typeof professionalSchema>;
