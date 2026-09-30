import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from 'core/entities/AdminQuery';

/**
 * Ajustes › Registro de acciones (`0071`): the closed list of admin mutations
 * that leave a row, plus the automatic activation on email confirmation.
 * Nothing else writes here, and nothing here is a free-form string a caller
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
  'picture.discarded'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** How an account came to be activated — never the request body, only this. */
export const ACCOUNT_ACTIVATION_VIA = ['console', 'mail_link', 'automatic'] as const;

export type AccountActivationVia = (typeof ACCOUNT_ACTIVATION_VIA)[number];

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
  'feedback.handled': Record<string, never>;
  'feedback.reopened': Record<string, never>;
  'picture.discarded': Record<string, never>;
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
