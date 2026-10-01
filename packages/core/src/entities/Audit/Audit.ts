import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from 'core/entities/AdminQuery';
import type { PictureAcceptedBy } from 'core/entities/DishPicture';

/**
 * Ajustes › Registro de acciones (`0071`): the closed list of admin mutations
 * that leave a row, plus the automatic activation on email confirmation, plus
 * two acts a person does to their own account's security (PLAN 011 phase 2):
 * changing the password and closing sessions. Nothing else writes here, and nothing here is a free-form string a caller
 * invents — a new admin mutation is a new name added to this list, reviewed,
 * not a string typed at the call site.
 */
export const AUDIT_ACTIONS = [
  'account.activated',
  'account.tier_changed',
  'professional.granted',
  'professional.revoked',
  'feedback.handled',
  'feedback.reopened',
  'setting.changed',
  'push.test_sent',
  'picture.retried',
  'picture.discarded',
  'picture.accepted',
  'picture.removed',
  'auth.password_changed',
  'auth.sessions_revoked'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** How an account came to be activated — never the request body, only this. */
export const ACCOUNT_ACTIVATION_VIA = ['console', 'mail_link', 'automatic'] as const;

export type AccountActivationVia = (typeof ACCOUNT_ACTIVATION_VIA)[number];

/** How a password came to change: from a signed-in session, or from a reset link. */
export const PASSWORD_CHANGED_VIA = ['change', 'reset'] as const;

export type PasswordChangedVia = (typeof PASSWORD_CHANGED_VIA)[number];

/** Which sessions a person closed: one other device, every other device, or every device including this one. */
export const SESSIONS_REVOKED_SCOPE = ['one', 'others', 'all'] as const;

export type SessionsRevokedScope = (typeof SESSIONS_REVOKED_SCOPE)[number];

/**
 * Stands where an audit argument is otherwise required, for a suite or a
 * probe that moves a row to set a scenario up rather than to exercise the
 * console (`0071`). `apps/api/src` never has a reason to reach for it — a
 * route always has a session or a signed link, so it always has a real audit
 * to give — and a grep-style test keeps it that way
 * (`apps/api/src/modules/admin/audit-boundary.spec.ts`).
 */
export const UNAUDITED = Symbol('core/entities/Audit#UNAUDITED');

/**
 * Who may have opened an account, matched to how: the console always has a
 * session, the mail link and the automatic activation on email confirmation
 * never do. A discriminated union so a caller cannot pair `console` with a
 * null actor or `mail_link` with a real one.
 */
export type ActivationAudit =
  { readonly actorId: null; readonly via: 'automatic' | 'mail_link' } | { readonly actorId: string; readonly via: 'console' };

/**
 * The metadata each action carries, keyed by its own name — so a call that
 * writes the wrong shape for an action fails to compile rather than landing a
 * row nobody can read back sensibly. An action with nothing to say beyond
 * "it happened" carries an empty object, never `null`: the column stays
 * `jsonb`, and the console's detail column reads the same shape either way.
 */
export interface AuditMetadataByAction {
  'account.activated': { readonly via: AccountActivationVia };
  'account.tier_changed': { readonly from: string; readonly to: string };
  /**
   * The account's password changed (PLAN 011 phase 2), and through which door. A closed word and nothing
   * else: never a token, an IP address, a user agent, a session id, nor anything of the password.
   */
  'auth.password_changed': { readonly via: PasswordChangedVia };
  /** The person closed sessions of their own (PLAN 011 phase 2): which ones, in a closed word. Never a token, an IP, a user agent or a session id. */
  'auth.sessions_revoked': { readonly scope: SessionsRevokedScope };
  'feedback.handled': Record<string, never>;
  'feedback.reopened': Record<string, never>;
  /** The owner published a picture the judge rejected (`0072`): the allergen keys the judge flagged and the owner overrode — catalogue keys, never a path, never a model's words. */
  'picture.accepted': { readonly allergens: readonly string[] };
  'picture.discarded': Record<string, never>;
  /**
   * The owner took a published picture back (`0072`, project 010 phase 4): which door it had come through, in a closed
   * word — `judge` or `owner` (`PICTURE_ACCEPTED_BY`). Never a path, an address or a model's words. Rows written before
   * phase 4, when only a hand-accepted picture could be removed, carry `{}`.
   */
  'picture.removed': { readonly acceptedBy: PictureAcceptedBy };
  'picture.retried': Record<string, never>;
  'professional.granted': Record<string, never>;
  'professional.revoked': Record<string, never>;
  'push.test_sent': Record<string, never>;
  'setting.changed': { readonly enabled: boolean; readonly key: string };
}

const offset = z.coerce.number().int().min(0).max(1_000_000).default(0);

const size = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

/** `GET /admin/audit`: filter by action, newest first, paged. */
export const auditQuerySchema = z.object({ action: z.enum(AUDIT_ACTIONS).optional(), offset, size });

export type AuditQuery = z.infer<typeof auditQuerySchema>;
