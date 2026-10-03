import { and, count, desc, eq, like, lt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { database } from 'database';
import { auditLogs } from 'database/schema/platform';
import { user } from 'database/schema/auth';

import { AUTH_AUDIT_PREFIX } from 'core/entities/Audit';
import { DatabaseOperationError } from 'core/entities/Error';

import type { AuditAction, AuditMetadataByAction } from 'core/entities/Audit';

/** The two names the account table joins under: whoever acted, and whoever it was about — never the same row read twice under one name. */
const actor = alias(user, 'audit_actor');
const subject = alias(user, 'audit_subject');

/** The transaction handle a write's own repository opens, handed down so a watcher's row lands inside it. */
export type Transaction = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

/**
 * Writes an admin mutation's row into the transaction that makes the change —
 * `CareRepository.logAccess`'s pattern (`0059`), extended to the admin
 * screens (`0071`): an action that is not also this write did not happen.
 * Handed by a domain controller to the repository that writes, and called by
 * that repository inside its own transaction.
 */
export type RecordAudit = (tx: Transaction) => Promise<void>;

export type AuditEntry<A extends AuditAction = AuditAction> = {
  readonly action: A;
  /** The session's user, or `null` for the mail link and the automatic activation. */
  readonly actorId: string | null;
  /** What kind of thing this action is about — never a person; a person is `subjectUserId`. */
  readonly entity: string;
  /** What is not a person: a setting's key, or a feedback message's id. */
  readonly entityId?: string | null;
  readonly metadata: AuditMetadataByAction[A];
  /** The account this action was about, or `null` when it was about nothing that is a person. */
  readonly subjectUserId?: string | null;
};

export type AuditRow = {
  readonly action: string;
  readonly actorEmail: string | null;
  readonly createdAt: Date;
  readonly metadata: Record<string, unknown> | null;
  readonly subjectEmail: string | null;
};

/**
 * Ajustes › Registro de acciones (`0071`): who did what to which account, and
 * when. Never a request body, never an IP address (`ipHash` stays empty).
 */
export const AuditRepository = {
  /**
   * The retention of a person's account-security trail (PLAN 011 phase 7):
   * every `auth.*` row written before `cutoff`, and nothing else — an admin
   * action's row is kept whatever its age. Answers how many went.
   */
  async forgetAuthRowsBefore(cutoff: Date): Promise<number> {
    try {
      const rows = await database()
        .delete(auditLogs)
        .where(and(like(auditLogs.action, `${AUTH_AUDIT_PREFIX}%`), lt(auditLogs.createdAt, cutoff)))
        .returning({ id: auditLogs.id });

      return rows.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** One page, newest first; the tail of the order (the id) keeps a page boundary stable when two rows land in the same instant. */
  async page(
    filter: { readonly action?: AuditAction },
    offset: number,
    size: number
  ): Promise<{ readonly rows: readonly AuditRow[]; readonly total: number }> {
    try {
      const db = database();
      const where = filter.action === undefined ? undefined : eq(auditLogs.action, filter.action);
      const [rows, counted] = await Promise.all([
        db
          .select({
            action: auditLogs.action,
            actorEmail: actor.email,
            createdAt: auditLogs.createdAt,
            metadata: auditLogs.metadata,
            subjectEmail: subject.email
          })
          .from(auditLogs)
          .leftJoin(actor, eq(actor.id, auditLogs.actorId))
          .leftJoin(subject, eq(subject.id, auditLogs.subjectUserId))
          .where(where)
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(size)
          .offset(offset),
        db.select({ n: count() }).from(auditLogs).where(where)
      ]);

      return { rows, total: counted[0]?.n ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One row, in the caller's transaction when it gives one (`tx`) — so a
   * refused or failed action leaves no row, and an action that commits always
   * has one. Without a `tx`, for the one action with nothing to share a
   * transaction with (`push.test_sent`: sending a push is a call to a
   * provider, not a database write).
   */
  async record<A extends AuditAction>(entry: AuditEntry<A>, tx?: Transaction): Promise<void> {
    try {
      await (tx ?? database())
        .insert(auditLogs)
        .values({
          action: entry.action,
          actorId: entry.actorId,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
          subjectUserId: entry.subjectUserId ?? null
        });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
