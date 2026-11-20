import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeUser } from '#test/fixtures';
import { ConflictError, InputParseError, NotFoundError, NoticeDailyCapError } from 'core/entities/Error';
import { NOTICE_BATCH_SIZE, NOTICE_DAILY_CAP, NOTICE_PRESS_BUDGET_MS } from 'core/entities/Notice';

import { NoticeController } from './NoticeController';

import type { DeliverNotice } from './NoticeController';
import type { AccountNotice } from 'core/entities/Notice';
import type { NoticeCandidate, NoticeCounts, NoticeSent } from '#repositories/Notice';
import type { User } from 'core/entities/User';

const NOW = new Date('2026-11-20T11:00:00.000Z');
const TOMORROW = '2026-11-21';
const PAGE = { offset: 0, size: 25 };

type Page = { readonly after?: string; readonly limit: number; readonly offset?: number };

const candidates = vi.fn<(notice: AccountNotice, page: Page) => Promise<readonly NoticeCandidate[]>>();
const counts = vi.fn<(notice: AccountNotice) => Promise<NoticeCounts>>();
const effectiveOn = vi.fn<(notice: AccountNotice) => Promise<string | null>>();
const record = vi.fn<(userId: string, notice: AccountNotice, sent: NoticeSent) => Promise<void>>();
const sentBetween = vi.fn<(from: Date, to: Date) => Promise<number>>();
const locked = { held: false };
const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const auditRecord = vi.fn<(entry: unknown) => Promise<void>>();

vi.mock('#repositories/Notice', () => ({
  AccountNoticeRepository: {
    candidates: (notice: AccountNotice, page: Page) => candidates(notice, page),
    counts: (notice: AccountNotice) => counts(notice),
    effectiveOn: (notice: AccountNotice) => effectiveOn(notice),
    exclusively: async <T>(fn: () => Promise<T>) => (locked.held ? null : fn()),
    record: (userId: string, notice: AccountNotice, sent: NoticeSent) => record(userId, notice, sent),
    sentBetween: (from: Date, to: Date) => sentBetween(from, to)
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

function asCandidates(ids: readonly string[]): NoticeCandidate[] {
  return ids.map(id => ({ id, email: accounts.get(id)?.email ?? `${id}@example.invalid` }));
}

/** The accounts owed, in order; `after` is honoured as the repository honours it. */
function owed(...ids: string[]): void {
  candidates.mockImplementation(async (_notice, page) => {
    const from = page.after === undefined ? 0 : ids.indexOf(page.after) + 1;

    return asCandidates(page.after !== undefined && !ids.includes(page.after) ? [] : ids.slice(from, from + page.limit));
  });
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
  sentBetween.mockResolvedValue(0);
  findById.mockImplementation(async id => accounts.get(id));
  auditRecord.mockResolvedValue();
  deliver.mockImplementation(async () => ({ accepted: true, locale: 'es-ES' }));
});

function send(input: { after?: string; date: string } = { date: TOMORROW }, now = NOW, clock?: () => number) {
  return NoticeController.send('terms-2.4.0', 'usr-owner', input, deliver, now, clock);
}

/* Project 025 phase 10, `textos/06` § Z: the change notice, before the switch, to every account once. */
describe('NoticeController — the notice and its day', () => {
  it('is the 404 every unknown door gets for a notice not on the list, before anything is read', async () => {
    await expect(NoticeController.preview('terms-9.9.9', { date: TOMORROW }, PAGE, async () => 'es-ES', NOW)).rejects.toBeInstanceOf(NotFoundError);
    await expect(NoticeController.send('terms-9.9.9', 'usr-owner', { date: TOMORROW }, deliver, NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect(candidates).not.toHaveBeenCalled();
  });

  it.each([
    ['today, in Madrid', '2026-11-20', 'not_after_today'],
    ['yesterday', '2026-11-19', 'not_after_today'],
    ['61 days ahead — a slip of the year must not fix the campaign', '2027-01-20', 'too_far'],
    ['next year', '2027-11-21', 'too_far']
  ])('refuses a day that is %s', async (_, date, code) => {
    const refusal = await send({ date }).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(InputParseError);
    expect((refusal as InputParseError).fieldErrors).toEqual({ date: [code] });
    await expect(NoticeController.preview('terms-2.4.0', { date }, PAGE, async () => 'es-ES', NOW)).rejects.toBeInstanceOf(InputParseError);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('accepts the last day of the window: 60 days ahead', async () => {
    await expect(send({ date: '2027-01-19' })).resolves.toMatchObject({ sent: 0 });
  });

  it('takes today by Madrid’s calendar: at 23:30 UTC it is already tomorrow there', async () => {
    await expect(send({ date: TOMORROW }, new Date('2026-11-20T23:30:00.000Z'))).rejects.toBeInstanceOf(InputParseError);
  });

  it('refuses another day once the notice was sent for one: one notice, one day', async () => {
    effectiveOn.mockResolvedValue('2026-12-01');

    const refusal = await send({ date: '2026-12-02' }).catch((error: unknown) => error);

    expect((refusal as InputParseError).fieldErrors).toEqual({ date: ['campaign_date:2026-12-01'] });
    expect(deliver).not.toHaveBeenCalled();
  });

  it('accepts the same day again — the next batch of the same campaign', async () => {
    effectiveOn.mockResolvedValue('2026-12-01');

    await expect(send({ date: '2026-12-01' })).resolves.toMatchObject({ sent: 0 });
  });
});

describe('NoticeController.preview', () => {
  it('answers the totals from the counts, one page of recipients with only that page’s languages read, and the day as each mail writes it', async () => {
    candidates.mockResolvedValue([
      { id: 'usr-ana', email: 'ana@example.invalid' },
      { id: 'usr-ben', email: 'ben@example.invalid' }
    ]);
    counts.mockResolvedValue({ alreadySent: 4, toSend: 230, unconfirmed: 1 });
    const localeOf = vi.fn(async (id: string) => (id === 'usr-ben' ? 'en-GB' : 'es-ES'));

    const view = await NoticeController.preview('terms-2.4.0', { date: '2026-12-01' }, { offset: 100, size: 2 }, localeOf, NOW);

    expect(view).toEqual({
      alreadySent: 4,
      campaignDate: null,
      dateAsWritten: { 'en-GB': '1 December 2026', 'es-ES': '1 de diciembre de 2026' },
      recipients: {
        offset: 100,
        rows: [
          { email: 'ana@example.invalid', locale: 'es-ES' },
          { email: 'ben@example.invalid', locale: 'en-GB' }
        ],
        size: 2,
        total: 230
      },
      skippedUnconfirmed: 1,
      toSend: 230
    });
    expect(candidates).toHaveBeenCalledWith('terms-2.4.0', { limit: 2, offset: 100 });
    expect(localeOf).toHaveBeenCalledTimes(2);
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

    await expect(send()).resolves.toEqual({
      after: 'usr-ben',
      failed: 0,
      failedRecipients: [],
      remaining: 3,
      sent: 2,
      skippedUnconfirmed: 1,
      stoppedEarly: false
    });
    expect(candidates).toHaveBeenCalledWith('terms-2.4.0', { limit: NOTICE_BATCH_SIZE });
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
  });

  it('mails the address as it is now, re-read just before its mail', async () => {
    account('usr-ana', { email: 'ana-new@example.invalid' });
    candidates.mockResolvedValue([{ id: 'usr-ana', email: 'ana-old@example.invalid' }]);

    await send();

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

    await expect(send()).resolves.toMatchObject({ failed: 0, sent: 1 });
    expect(deliver.mock.calls.map(([candidate]) => candidate.id)).toEqual(['usr-ana']);
  });

  it('writes no row for a mail the server did not accept, names it to the owner, and carries on — the account stays owed', async () => {
    account('usr-ana');
    account('usr-ben');
    owed('usr-ana', 'usr-ben');
    deliver.mockImplementation(async candidate => ({ accepted: candidate.id !== 'usr-ana', locale: 'es-ES' }));

    await expect(send()).resolves.toMatchObject({ failed: 1, failedRecipients: [{ email: 'usr-ana@example.invalid' }], sent: 1 });
    expect(record.mock.calls.map(([id]) => id)).toEqual(['usr-ben']);
    // The address goes to the owner's console only: never into the audit row.
    expect(JSON.stringify(auditRecord.mock.calls)).not.toContain('@example.invalid');
  });

  it('treats a mail that threw as one not accepted', async () => {
    account('usr-ana');
    owed('usr-ana');
    deliver.mockRejectedValue(new Error('template failed'));

    await expect(send()).resolves.toMatchObject({ failed: 1, failedRecipients: [{ email: 'usr-ana@example.invalid' }], sent: 0 });
    expect(record).not.toHaveBeenCalled();
  });

  /*
   * Head of line: 25 addresses the server always refuses must not starve the
   * rest. The press answers the last account it tried as `after`; the next press
   * starts after it; when nothing is owed after it, it starts from the oldest
   * again, so the refused ones are tried once a round.
   */
  it('moves past a whole batch of refused addresses on the next press, and comes back to them once the rest are done', async () => {
    const refused = Array.from({ length: NOTICE_BATCH_SIZE }, (_, n) => `usr-r${String(n).padStart(2, '0')}`);
    const fine = ['usr-x1', 'usr-x2'];

    for (const id of [...refused, ...fine]) {
      account(id);
    }

    owed(...refused, ...fine);
    deliver.mockImplementation(async candidate => ({ accepted: !candidate.id.startsWith('usr-r'), locale: 'es-ES' }));

    const first = await send();

    expect(first).toMatchObject({ after: refused.at(-1), failed: NOTICE_BATCH_SIZE, sent: 0 });
    expect(first.failedRecipients).toHaveLength(NOTICE_BATCH_SIZE);

    const second = await send({ after: first.after ?? undefined, date: TOMORROW });

    expect(second).toMatchObject({ after: 'usr-x2', failed: 0, sent: 2 });

    owed(...refused);
    const third = await send({ after: second.after ?? undefined, date: TOMORROW });

    // Nothing owed after `usr-x2` any more: the press starts from the oldest, and tries the refused ones again.
    expect(third).toMatchObject({ after: refused.at(-1), failed: NOTICE_BATCH_SIZE });
  });

  it('never tries an account twice in one press', async () => {
    account('usr-ana');
    owed('usr-ana');
    deliver.mockResolvedValue({ accepted: false, locale: 'es-ES' });

    await send();

    expect(deliver).toHaveBeenCalledTimes(1);
  });

  /*
   * The one way an account can be mailed twice from a press that completes: its
   * mail accepted, then its row not written. Send-then-record makes this failure
   * a second identical mail on a later press — never a notice recorded as sent
   * that was not. The press stops there: the database is failing.
   */
  it('counts an accepted mail whose row could not be written as failed, stops the press, and leaves the account owed', async () => {
    account('usr-ana');
    account('usr-ben');
    owed('usr-ana', 'usr-ben');
    record.mockRejectedValueOnce(new Error('database down'));

    await expect(send()).resolves.toMatchObject({ failed: 1, failedRecipients: [{ email: 'usr-ana@example.invalid' }], sent: 0 });
    expect(deliver.mock.calls.map(([candidate]) => candidate.id)).toEqual(['usr-ana']);

    // The next press from the start: ana is still owed (no row), so she is mailed again — the documented second mail.
    record.mockResolvedValue();
    await send();

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

    await expect(send()).resolves.toMatchObject({ failed: 0, sent: 2 });
  });

  it('never mails an account twice across presses when every row is written: a told account is not a candidate', async () => {
    account('usr-ana');
    owed('usr-ana');

    await send();
    candidates.mockResolvedValue([]);
    await expect(send()).resolves.toMatchObject({ after: null, sent: 0 });

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(auditRecord).toHaveBeenCalledTimes(2);
  });

  it('is a 409 while another press runs, and mails nobody', async () => {
    account('usr-ana');
    owed('usr-ana');
    locked.held = true;

    await expect(send()).rejects.toBeInstanceOf(ConflictError);
    expect(deliver).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('checks the day again under the lock: a press that just finished may have fixed another', async () => {
    effectiveOn.mockResolvedValueOnce(null).mockResolvedValueOnce('2026-12-01');

    await expect(send()).rejects.toBeInstanceOf(InputParseError);
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe('NoticeController.send — the shared mailbox’s day', () => {
  it('counts today’s rows of every notice in Madrid’s day, under the lock', async () => {
    await send();

    expect(sentBetween).toHaveBeenCalledWith(new Date('2026-11-19T23:00:00.000Z'), new Date('2026-11-20T23:00:00.000Z'));
  });

  it('refuses a press once today’s cap is spent, with the cap and when it resets, mailing nobody', async () => {
    account('usr-ana');
    owed('usr-ana');
    sentBetween.mockResolvedValue(NOTICE_DAILY_CAP);

    const refusal = await send().catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(NoticeDailyCapError);
    expect(refusal).toMatchObject({ cap: NOTICE_DAILY_CAP, resetsAt: new Date('2026-11-20T23:00:00.000Z') });
    expect(deliver).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('sends only up to the cap when a press would cross it', async () => {
    const ids = Array.from({ length: 10 }, (_, n) => `usr-${String(n)}`);

    ids.forEach(id => account(id));
    owed(...ids);
    sentBetween.mockResolvedValue(NOTICE_DAILY_CAP - 3);

    await expect(send()).resolves.toMatchObject({ sent: 3 });
    expect(candidates).toHaveBeenCalledWith('terms-2.4.0', { limit: 3 });
  });
});

describe('NoticeController.send — the press’s time budget', () => {
  it('starts no mail once the press has run its budget, answers what it sent, and says it stopped early', async () => {
    ['usr-a', 'usr-b', 'usr-c'].forEach(id => account(id));
    owed('usr-a', 'usr-b', 'usr-c');
    let elapsed = 0;
    deliver.mockImplementation(async () => {
      elapsed += NOTICE_PRESS_BUDGET_MS / 2;

      return { accepted: true, locale: 'es-ES' };
    });

    await expect(send({ date: TOMORROW }, NOW, () => elapsed)).resolves.toMatchObject({ after: 'usr-b', sent: 2, stoppedEarly: true });
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(auditRecord).toHaveBeenCalledTimes(1);
  });
});
