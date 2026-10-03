import { beforeEach, describe, expect, it, vi } from 'vitest';

import { auditQuerySchema } from 'core/entities/Audit';

import { AuditController } from './AuditController';

import type { AuditAction, AuditQuery } from 'core/entities/Audit';
import type { AuditRow } from '#repositories/Audit';

const page = vi.fn<(filter: { action?: AuditAction }, offset: number, size: number) => Promise<{ rows: readonly AuditRow[]; total: number }>>();
const record = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();
const forgetAuthRowsBefore = vi.fn<(cutoff: Date) => Promise<number>>();

vi.mock('#repositories/Audit', () => ({
  AuditRepository: {
    forgetAuthRowsBefore: (cutoff: Date) => forgetAuthRowsBefore(cutoff),
    page: (filter: { action?: AuditAction }, offset: number, size: number) => page(filter, offset, size),
    record: (entry: unknown, tx?: unknown) => record(entry, tx)
  }
}));

function query(raw: Partial<AuditQuery> = {}): AuditQuery {
  return auditQuerySchema.parse(raw);
}

beforeEach(() => {
  page.mockReset();
  record.mockReset();
  forgetAuthRowsBefore.mockReset();
});

describe('AuditController.list', () => {
  it('presents each row as at/action/actor/subject/detail, and nothing else', async () => {
    page.mockResolvedValue({
      rows: [
        {
          action: 'account.tier_changed',
          actorEmail: 'owner@example.com',
          createdAt: new Date('2026-09-29T08:00:00.000Z'),
          metadata: { from: 'free', to: 'premium' },
          subjectEmail: 'user@example.com'
        }
      ],
      total: 1
    });

    const result = await AuditController.list(query({ action: 'account.tier_changed' }));

    expect(page).toHaveBeenCalledWith({ action: 'account.tier_changed' }, 0, 25);
    expect(result).toEqual({
      offset: 0,
      rows: [
        {
          action: 'account.tier_changed',
          actor: 'owner@example.com',
          at: '2026-09-29T08:00:00.000Z',
          detail: { from: 'free', to: 'premium' },
          subject: 'user@example.com'
        }
      ],
      size: 25,
      total: 1
    });
    expect(Object.keys(result.rows[0] ?? {}).sort()).toEqual(['action', 'actor', 'at', 'detail', 'subject']);
  });

  it('reads a null actor and a null subject as null, never as a placeholder string', async () => {
    page.mockResolvedValue({
      rows: [{ action: 'push.test_sent', actorEmail: null, createdAt: new Date('2026-09-29T08:00:00.000Z'), metadata: {}, subjectEmail: null }],
      total: 1
    });

    const { rows } = await AuditController.list();

    expect(rows[0]).toMatchObject({ actor: null, subject: null });
  });
});

describe('AuditController.record', () => {
  it('writes a standalone row with no transaction, for the one action with none to share', async () => {
    await AuditController.record({ action: 'push.test_sent', actorId: 'usr-owner', entity: 'push', metadata: {} });

    expect(record).toHaveBeenCalledWith({ action: 'push.test_sent', actorId: 'usr-owner', entity: 'push', metadata: {} }, undefined);
  });
});

describe('AuditController.forgetExpiredAuthRows', () => {
  it('asks for the auth rows older than twelve calendar months, and answers how many went', async () => {
    forgetAuthRowsBefore.mockResolvedValue(4);

    await expect(AuditController.forgetExpiredAuthRows(new Date('2026-10-03T08:05:00.000Z'))).resolves.toBe(4);
    expect(forgetAuthRowsBefore).toHaveBeenCalledWith(new Date('2025-10-03T08:05:00.000Z'));
  });
});
