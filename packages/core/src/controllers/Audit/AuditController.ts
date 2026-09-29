import { AuditRepository } from '#repositories/Audit';
import { auditQuerySchema } from 'core/entities/Audit';

import type { AuditAction, AuditMetadataByAction, AuditQuery } from 'core/entities/Audit';
import type { AuditRow } from '#repositories/Audit';
import type { Paged } from 'core/controllers/User';

// --- Presenters ---------------------------------------------------------------

/**
 * One row of Ajustes › Registro de acciones. `detail` is the closed metadata
 * for the action and nothing else — never a request body, never an IP.
 */
export interface AuditLogView {
  readonly action: string;
  readonly actor: string | null;
  readonly at: string;
  readonly detail: Record<string, unknown> | null;
  readonly subject: string | null;
}

function present(row: AuditRow): AuditLogView {
  return { action: row.action, actor: row.actorEmail, at: row.createdAt.toISOString(), detail: row.metadata, subject: row.subjectEmail };
}

// --- Controller ---------------------------------------------------------------

/**
 * The owner's own trail (`0071`): who did what, to which account, and when.
 * Every row was written in the same transaction as the action it recorded
 * (`AuditRepository.record`) — this controller only reads them back, save for
 * `record`, which exists for the one action with no transaction to share.
 */
export const AuditController = {
  /** One page, newest first, filtered by action when the query asks. */
  async list(query: AuditQuery = auditQuerySchema.parse({})): Promise<Paged<AuditLogView>> {
    const { rows, total } = await AuditRepository.page({ action: query.action }, query.offset, query.size);

    return { offset: query.offset, rows: rows.map(present), size: query.size, total };
  },

  /**
   * A standalone row for `push.test_sent`: sending a test push is a call to
   * the push service, not a database write, so there is nothing to share a
   * transaction with. A crash between the send resolving and this landing
   * leaves the test unrecorded — accepted, since nothing else about it is
   * recorded either.
   */
  async record<A extends AuditAction>(entry: {
    readonly action: A;
    readonly actorId: string | null;
    readonly entity: string;
    readonly entityId?: string | null;
    readonly metadata: AuditMetadataByAction[A];
    readonly subjectUserId?: string | null;
  }): Promise<void> {
    await AuditRepository.record(entry);
  }
};
