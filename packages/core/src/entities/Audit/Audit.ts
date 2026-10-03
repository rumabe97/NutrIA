import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from 'core/entities/AdminQuery';
import type { PictureAcceptedBy } from 'core/entities/DishPicture';
import type { TwoFactorRemovalCancelledBy } from 'core/entities/TwoFactor';

/**
 * Ajustes › Registro de acciones (`0071`): the closed list of admin mutations
 * that leave a row, plus the automatic activation on email confirmation, plus
 * the acts a person does to their own account's security (PLAN 011 phases 2
 * and 3): changing the password, closing sessions, turning the second factor
 * on or off, spending a backup code and generating new ones; and the owner's
 * removal of a lost second factor (phase 4). Nothing else writes here, and nothing here is a free-form string a caller
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
  'auth.sessions_revoked',
  'auth.2fa_enabled',
  'auth.2fa_disabled',
  'auth.backup_code_used',
  'auth.backup_codes_regenerated',
  'auth.2fa_removal_requested',
  'auth.2fa_removal_cancelled',
  'auth.2fa_removed_by_owner'
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
  /** The second factor went off (PLAN 011 phase 3). Nothing else: never the secret, a code or a session id. */
  'auth.2fa_disabled': Record<string, never>;
  /** The second factor went on — the first correct code after `/two-factor/enable` (PLAN 011 phase 3). Nothing else. */
  'auth.2fa_enabled': Record<string, never>;
  /**
   * A pending removal of the second factor was cancelled (PLAN 011 phase 4): by the owner from the console, or by the
   * account entering a correct code. Who, in a closed word, and nothing else.
   */
  'auth.2fa_removal_cancelled': { readonly by: TwoFactorRemovalCancelledBy };
  /** The owner asked for the account's lost second factor to be removed in 48 hours (PLAN 011 phase 4). Nothing else: never the request's reason, address or headers. */
  'auth.2fa_removal_requested': Record<string, never>;
  /** The daily cron removed the second factor the owner had asked to remove, its 48 hours past (PLAN 011 phase 4). No actor. Nothing else. */
  'auth.2fa_removed_by_owner': Record<string, never>;
  /** A backup code was spent (PLAN 011 phase 3): how many are left, and never which one. */
  'auth.backup_code_used': { readonly remaining: number };
  /** Ten new backup codes replaced the old ones (PLAN 011 phase 3). Nothing else: never a code. */
  'auth.backup_codes_regenerated': Record<string, never>;
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
