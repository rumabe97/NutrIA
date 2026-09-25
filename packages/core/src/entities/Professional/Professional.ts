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
 * The professional's agreement and the practice plan's terms, accepted together
 * on one screen before any client's data is shown or the practice is paid for
 * (`docs/legal/textos/01` and `04`). The version is code and the words are the
 * web app's dictionary, as `CARE_CONSENT_VERSION` is: a stored version that is
 * not this one asks again, and accepting an older one is refused at the door.
 */
export const PROFESSIONAL_AGREEMENT_VERSION = '1.0.0';

/** The professional's acceptance: the current version, and nothing else. */
export const acceptAgreementSchema = z.object({ version: z.literal(PROFESSIONAL_AGREEMENT_VERSION) });

export type AcceptAgreement = z.infer<typeof acceptAgreementSchema>;

/**
 * The row as `professionals` holds it. `grantedBy` is another account's id —
 * the owner's — and is the one field no presenter may carry.
 */
export const professionalSchema = z.object({
  id: z.uuid(),
  agreementAcceptedAt: z.date().nullable(),
  agreementVersion: z.string().min(1).nullable(),
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
