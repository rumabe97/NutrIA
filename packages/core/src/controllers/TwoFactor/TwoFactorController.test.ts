import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, TwoFactorRemovalRefusedError } from 'core/entities/Error';

import { TwoFactorController } from './TwoFactorController';

import type { RemovalRequest } from '#repositories/TwoFactor';

type Record = (tx: unknown) => Promise<void>;

const request = vi.fn<(userId: string, requestedBy: string, now: Date, dueAt: Date, record: Record) => Promise<RemovalRequest>>();
const cancel = vi.fn<(userId: string, now: Date, record: Record) => Promise<{ email: string } | null>>();
const remove = vi.fn<(userId: string, now: Date, record: Record) => Promise<{ email: string } | null>>();
const due = vi.fn<(now: Date) => Promise<readonly string[]>>();
const claimTotpStep = vi.fn<(userId: string, step: number) => Promise<boolean>>();
const audit = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();

vi.mock('#repositories/TwoFactor', () => ({
  TwoFactorRepository: {
    cancel: (userId: string, now: Date, r: Record) => cancel(userId, now, r),
    claimTotpStep: (userId: string, step: number) => claimTotpStep(userId, step),
    due: (now: Date) => due(now),
    remove: (userId: string, now: Date, r: Record) => remove(userId, now, r),
    request: (userId: string, requestedBy: string, now: Date, dueAt: Date, r: Record) => request(userId, requestedBy, now, dueAt, r)
  }
}));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => audit(entry, tx) } }));

const NOW = new Date('2026-10-01T19:00:00.000Z');
const TX = { tx: true };

/** Runs the audit closure a repository was handed, the way it would inside its transaction, and answers what it wrote. */
async function written(closure: Record | undefined): Promise<unknown> {
  await closure?.(TX);

  return audit.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.resetAllMocks();
});

/* PLAN 011 phase 4: the owner asks, the cron removes 48 hours later at the earliest. */
describe('TwoFactorController.requestRemoval', () => {
  it('asks for the removal 48 hours from now and answers when it falls due, with the address for the mail', async () => {
    request.mockResolvedValue({ dueAt: new Date('2026-10-03T19:00:00.000Z'), email: 'ana@example.invalid', kind: 'requested' });

    await expect(TwoFactorController.requestRemoval('usr-7', 'adm-1', NOW)).resolves.toEqual({
      dueAt: '2026-10-03T19:00:00.000Z',
      email: 'ana@example.invalid'
    });
    expect(request).toHaveBeenCalledWith('usr-7', 'adm-1', NOW, new Date('2026-10-03T19:00:00.000Z'), expect.any(Function));
  });

  it('writes its row with the owner as actor and the account as subject, and nothing else', async () => {
    request.mockResolvedValue({ dueAt: new Date('2026-10-03T19:00:00.000Z'), email: 'ana@example.invalid', kind: 'requested' });

    await TwoFactorController.requestRemoval('usr-7', 'adm-1', NOW);

    expect(await written(request.mock.calls[0]?.[4])).toEqual({
      action: 'auth.2fa_removal_requested',
      actorId: 'adm-1',
      entity: 'user',
      metadata: {},
      subjectUserId: 'usr-7'
    });
    expect(audit).toHaveBeenCalledWith(expect.anything(), TX);
  });

  it('answers an unknown account with the same NotFoundError as every denial', async () => {
    request.mockResolvedValue({ kind: 'missing' });

    await expect(TwoFactorController.requestRemoval('nobody', 'adm-1', NOW)).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(['not_enabled', 'pending'] as const)('refuses with its reason when the repository says %s', async kind => {
    request.mockResolvedValue({ kind });

    await expect(TwoFactorController.requestRemoval('usr-7', 'adm-1', NOW)).rejects.toEqual(new TwoFactorRemovalRefusedError(kind));
  });
});

describe('TwoFactorController.cancelRemovalByOwner', () => {
  it('cancels and writes { by: owner } with the owner as actor', async () => {
    cancel.mockResolvedValue({ email: 'ana@example.invalid' });

    await expect(TwoFactorController.cancelRemovalByOwner('usr-7', 'adm-1', NOW)).resolves.toEqual({ email: 'ana@example.invalid' });
    expect(cancel).toHaveBeenCalledWith('usr-7', NOW, expect.any(Function));
    expect(await written(cancel.mock.calls[0]?.[2])).toEqual({
      action: 'auth.2fa_removal_cancelled',
      actorId: 'adm-1',
      entity: 'user',
      metadata: { by: 'owner' },
      subjectUserId: 'usr-7'
    });
  });

  it('answers nothing pending with a NotFoundError', async () => {
    cancel.mockResolvedValue(null);

    await expect(TwoFactorController.cancelRemovalByOwner('usr-7', 'adm-1', NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('TwoFactorController.cancelRemovalByAccount', () => {
  it('cancels and writes { by: account } with the account as its own actor', async () => {
    cancel.mockResolvedValue({ email: 'ana@example.invalid' });

    await expect(TwoFactorController.cancelRemovalByAccount('usr-7', NOW)).resolves.toEqual({ email: 'ana@example.invalid' });
    expect(await written(cancel.mock.calls[0]?.[2])).toEqual({
      action: 'auth.2fa_removal_cancelled',
      actorId: 'usr-7',
      entity: 'user',
      metadata: { by: 'account' },
      subjectUserId: 'usr-7'
    });
  });

  it('is silent when nothing was pending — the common case', async () => {
    cancel.mockResolvedValue(null);

    await expect(TwoFactorController.cancelRemovalByAccount('usr-7', NOW)).resolves.toBeNull();
  });
});

describe('TwoFactorController.removeDue', () => {
  it('removes and writes auth.2fa_removed_by_owner with no actor', async () => {
    remove.mockResolvedValue({ email: 'ana@example.invalid' });

    await expect(TwoFactorController.removeDue('usr-7', NOW)).resolves.toEqual({ email: 'ana@example.invalid', userId: 'usr-7' });
    expect(remove).toHaveBeenCalledWith('usr-7', NOW, expect.any(Function));
    expect(await written(remove.mock.calls[0]?.[2])).toEqual({
      action: 'auth.2fa_removed_by_owner',
      actorId: null,
      entity: 'user',
      metadata: {},
      subjectUserId: 'usr-7'
    });
  });

  it('answers null when nothing was removed', async () => {
    remove.mockResolvedValue(null);

    await expect(TwoFactorController.removeDue('usr-7', NOW)).resolves.toBeNull();
  });
});

describe('TwoFactorController.dueRemovals and claimTotpStep', () => {
  it('pass through to the repository', async () => {
    due.mockResolvedValue(['usr-7']);
    claimTotpStep.mockResolvedValue(false);

    await expect(TwoFactorController.dueRemovals(NOW)).resolves.toEqual(['usr-7']);
    await expect(TwoFactorController.claimTotpStep('usr-7', 59_000_000)).resolves.toBe(false);
    expect(due).toHaveBeenCalledWith(NOW);
    expect(claimTotpStep).toHaveBeenCalledWith('usr-7', 59_000_000);
  });
});
