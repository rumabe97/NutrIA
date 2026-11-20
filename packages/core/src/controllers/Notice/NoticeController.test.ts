import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeUser } from '#test/fixtures';
import { ConflictError, InputParseError, NotFoundError } from 'core/entities/Error';
import { NOTICE_BATCH_SIZE } from 'core/entities/Notice';

import { NoticeController } from './NoticeController';

import type { DeliverNotice } from './NoticeController';
import type { AccountNotice } from 'core/entities/Notice';
import type { NoticeCandidate, NoticeCounts, NoticeSent } from '#repositories/Notice';
import type { User } from 'core/entities/User';

const NOW = new Date('2026-11-20T11:00:00.000Z');
const TOMORROW = '2026-11-21';

const candidates = vi.fn<(notice: AccountNotice, limit?: number) => Promise<readonly NoticeCandidate[]>>();
const counts = vi.fn<(notice: AccountNotice) => Promise<NoticeCounts>>();
const effectiveOn = vi.fn<(notice: AccountNotice) => Promise<string | null>>();
const record = vi.fn<(userId: string, notice: AccountNotice, sent: NoticeSent) => Promise<void>>();
const locked = { held: false };
const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const auditRecord = vi.fn<(entry: unknown) => Promise<void>>();

vi.mock('#repositories/Notice', () => ({
  AccountNoticeRepository: {
    candidates: (notice: AccountNotice, limit?: number) => candidates(notice, limit),
    counts: (notice: AccountNotice) => counts(notice),
    effectiveOn: (notice: AccountNotice) => effectiveOn(notice),
    exclusively: async <T>(_notice: AccountNotice, fn: () => Promise<T>) => (locked.held ? null : fn()),
    record: (userId: string, notice: AccountNotice, sent: NoticeSent) => record(userId, notice, sent)
  }
}));
vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findById(id) } }));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown) => auditRecord(entry) } }));

/** Accounts as the database has them now: a missing id is an account deleted meanwhile. */
let accounts: Map<string, User>;

function account(id: string, overrides: Partial<User> = {}): User {
  const made = makeUser({ id, email: `${id}@example.invalid`, emailVerified: true, ...overrides });

  accounts.set(id, made);

  return made;
}

function owed(...ids: string[]): void {
  candidates.mockResolvedValue(ids.map(id => ({ id, email: accounts.get(id)?.email ?? `${id}@example.invalid` })));
}

const deliver = vi.fn<DeliverNotice>();

beforeEach(() => {
  vi.clearAllMocks();
  accounts = new Map();
  locked.held = false;
  candidates.mockResolvedValue([]);
  counts.mockResolvedValue({ alreadySent: 0, toSend: 0, unconfirmed: 0 });
  effectiveOn.mockResolvedValue(null);
  record.mockResolvedValue();
  findById.mockImplementation(async id => accounts.get(id));
  auditRecord.mockResolvedValue();
  deliver.mockImplementation(async () => ({ accepted: true, locale: 'es-ES' }));
});

/* Project 025 phase 10, `textos/06` § Z: the change notice, before the switch, to every account once. */
describe('NoticeController — the notice and its day', () => {
  it('is the 404 every unknown door gets for a notice not on the list, before anything is read', async () => {
    await expect(NoticeController.preview('terms-9.9.9', { date: TOMORROW }, async () => 'es-ES', NOW)).rejects.toBeInstanceOf(NotFoundError);
    await expect(NoticeController.send('terms-9.9.9', 'usr-owner', { date: TOMORROW }, deliver, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(candidates).not.toHaveBeenCalled();
  });

  it.each([
    ['today, in Madrid', '2026-11-20'],
    ['yesterday', '2026-11-19']
  ])('refuses a day that is %s: the notice comes before the change, never on its day', async (_, date) => {
    const refusal = await NoticeController.send('terms-2.4.0', 'usr-owner', { date }, deliver, NOW).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(InputParseError);
    expect((refusal as InputParseError).fieldErrors).toEqual({ date: ['not_after_today'] });
    await expect(NoticeController.preview('terms-2.4.0', { date }, async () => 'es-ES', NOW)).rejects.toBeInstanceOf(InputParseError);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('takes today by Madrid’s calendar: at 23:30 UTC it is already tomorrow there', async () => {
    const lateNight = new Date('2026-11-20T23:30:00.000Z');

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, lateNight)).rejects.toBeInstanceOf(InputParseError);
  });

  it('refuses another day once the notice was sent for one: one notice, one day', async () => {
    effectiveOn.mockResolvedValue('2026-12-01');

    const refusal = await NoticeController.send('terms-2.4.0', 'usr-owner', { date: '2026-12-02' }, deliver, NOW).catch((error: unknown) => error);

    expect((refusal as InputParseError).fieldErrors).toEqual({ date: ['campaign_date:2026-12-01'] });
    expect(deliver).not.toHaveBeenCalled();
  });

  it('accepts the same day again — the next batch of the same campaign', async () => {
    effectiveOn.mockResolvedValue('2026-12-01');

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: '2026-12-01' }, deliver, NOW)).resolves.toMatchObject({ sent: 0 });
  });
});

describe('NoticeController.preview', () => {
  it('lists every account owed the notice with the language it would be written in, and the counts, sending nothing', async () => {
    candidates.mockResolvedValue([
      { id: 'usr-ana', email: 'ana@example.invalid' },
      { id: 'usr-ben', email: 'ben@example.invalid' }
    ]);
    counts.mockResolvedValue({ alreadySent: 4, toSend: 2, unconfirmed: 1 });

    const view = await NoticeController.preview('terms-2.4.0', { date: TOMORROW }, async id => (id === 'usr-ben' ? 'en-GB' : 'es-ES'), NOW);

    expect(view).toEqual({
      alreadySent: 4,
      campaignDate: null,
      recipients: [
        { email: 'ana@example.invalid', locale: 'es-ES' },
        { email: 'ben@example.invalid', locale: 'en-GB' }
      ],
      skippedUnconfirmed: 1,
      toSend: 2
    });
    expect(candidates).toHaveBeenCalledWith('terms-2.4.0', undefined);
    expect(deliver).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

describe('NoticeController.send', () => {
  it('mails the next batch one by one, records each right after its mail is accepted, and audits the press with counts alone', async () => {
    account('usr-ana');
    account('usr-ben');
    owed('usr-ana', 'usr-ben');
    deliver.mockImplementation(async candidate => ({ accepted: true, locale: candidate.id === 'usr-ben' ? 'en-GB' : 'es-ES' }));
    counts.mockResolvedValue({ alreadySent: 2, toSend: 3, unconfirmed: 1 });

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).resolves.toEqual({
      failed: 0,
      remaining: 3,
      sent: 2,
      skippedUnconfirmed: 1
    });
    expect(candidates).toHaveBeenCalledWith('terms-2.4.0', NOTICE_BATCH_SIZE);
    expect(record.mock.calls.map(([id, notice, sent]) => [id, notice, sent.effectiveOn, sent.locale])).toEqual([
      ['usr-ana', 'terms-2.4.0', TOMORROW, 'es-ES'],
      ['usr-ben', 'terms-2.4.0', TOMORROW, 'en-GB']
    ]);
    // Each row right after its own mail: ana's row is written before ben is mailed.
    expect(record.mock.invocationCallOrder[0]).toBeLessThan(deliver.mock.invocationCallOrder[1] ?? 0);
    expect(auditRecord).toHaveBeenCalledExactlyOnceWith({
      action: 'notice.sent',
      actorId: 'usr-owner',
      entity: 'notice',
      entityId: 'terms-2.4.0',
      metadata: { date: TOMORROW, failed: 0, notice: 'terms-2.4.0', remaining: 3, sent: 2, skippedUnconfirmed: 1 }
    });
    expect(JSON.stringify(auditRecord.mock.calls)).not.toContain('@example.invalid');
  });

  it('mails the address as it is now, re-read just before its mail', async () => {
    account('usr-ana', { email: 'ana-new@example.invalid' });
    candidates.mockResolvedValue([{ id: 'usr-ana', email: 'ana-old@example.invalid' }]);

    await NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW);

    expect(deliver).toHaveBeenCalledWith({ id: 'usr-ana', email: 'ana-new@example.invalid' });
  });

  it('skips an account deleted after the batch was read, and one whose address is no longer confirmed', async () => {
    account('usr-ana');
    account('usr-cleo', { emailVerified: false });
    candidates.mockResolvedValue([
      { id: 'usr-gone', email: 'gone@example.invalid' },
      { id: 'usr-cleo', email: 'usr-cleo@example.invalid' },
      { id: 'usr-ana', email: 'usr-ana@example.invalid' }
    ]);

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).resolves.toMatchObject({ failed: 0, sent: 1 });
    expect(deliver.mock.calls.map(([candidate]) => candidate.id)).toEqual(['usr-ana']);
  });

  it('writes no row for a mail the server did not accept, counts it, and carries on — the account stays owed', async () => {
    account('usr-ana');
    account('usr-ben');
    owed('usr-ana', 'usr-ben');
    deliver.mockImplementation(async candidate => ({ accepted: candidate.id !== 'usr-ana', locale: 'es-ES' }));

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).resolves.toMatchObject({ failed: 1, sent: 1 });
    expect(record.mock.calls.map(([id]) => id)).toEqual(['usr-ben']);
  });

  it('treats a mail that threw as one not accepted', async () => {
    account('usr-ana');
    owed('usr-ana');
    deliver.mockRejectedValue(new Error('template failed'));

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).resolves.toMatchObject({ failed: 1, sent: 0 });
    expect(record).not.toHaveBeenCalled();
  });

  /*
   * The one way an account can be mailed twice: its mail accepted, then its row
   * not written. Send-then-record is chosen so that this failure is a second
   * identical mail on a later press — never a notice recorded as sent that was
   * not. The press stops there: the database is failing.
   */
  it('counts an accepted mail whose row could not be written as failed, stops the press, and leaves the account owed', async () => {
    account('usr-ana');
    account('usr-ben');
    owed('usr-ana', 'usr-ben');
    record.mockRejectedValueOnce(new Error('database down'));

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).resolves.toMatchObject({ failed: 1, sent: 0 });
    // Ben is not mailed this press: the press ended with ana.
    expect(deliver.mock.calls.map(([candidate]) => candidate.id)).toEqual(['usr-ana']);

    // The next press: ana is still owed (no row), so she is mailed again — the documented second mail.
    record.mockResolvedValue();
    await NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW);

    expect(deliver.mock.calls.map(([candidate]) => candidate.id)).toEqual(['usr-ana', 'usr-ana', 'usr-ben']);
  });

  it('counts as told an account deleted between its accepted mail and its row: nothing is owed to it', async () => {
    account('usr-ana');
    account('usr-ben');
    owed('usr-ana', 'usr-ben');
    record.mockImplementationOnce(async () => {
      accounts.delete('usr-ana');

      throw new Error('foreign key: the account is gone');
    });

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).resolves.toMatchObject({ failed: 0, sent: 2 });
  });

  it('never mails an account twice across presses when every row is written: a told account is not a candidate', async () => {
    account('usr-ana');
    owed('usr-ana');

    await NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW);
    candidates.mockResolvedValue([]);
    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).resolves.toMatchObject({ sent: 0 });

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(auditRecord).toHaveBeenCalledTimes(2);
  });

  it('is a 409 while another press of the same notice runs, and mails nobody', async () => {
    account('usr-ana');
    owed('usr-ana');
    locked.held = true;

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).rejects.toBeInstanceOf(ConflictError);
    expect(deliver).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('checks the day again under the lock: a press that just finished may have fixed another', async () => {
    effectiveOn.mockResolvedValueOnce(null).mockResolvedValueOnce('2026-12-01');

    await expect(NoticeController.send('terms-2.4.0', 'usr-owner', { date: TOMORROW }, deliver, NOW)).rejects.toBeInstanceOf(InputParseError);
    expect(deliver).not.toHaveBeenCalled();
  });
});
