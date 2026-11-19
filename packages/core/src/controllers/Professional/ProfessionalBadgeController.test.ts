import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeUser } from '#test/fixtures';
import { NotFoundError } from 'core/entities/Error';

import { badgeCodeHash, newBadgeCode, ProfessionalBadgeController } from './ProfessionalBadgeController';

import type * as Repositories from '#repositories/Professional';
import type { Badge, BadgeQueueRow, BadgeRecord, DueBadge, IssuedCheck, LapsedBadge, RemovedCheck } from '#repositories/Professional';
import type { BadgeChannel, ProfessionalBadgeCheck, ProfessionalBadgeCode } from 'core/entities/Professional';
import type { User } from 'core/entities/User';

const NOW = new Date('2026-11-18T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const record = vi.fn<(userId: string) => Promise<BadgeRecord>>();
const apply = vi.fn<(userId: string, input: unknown, now: Date) => Promise<boolean>>();
const enterCode = vi.fn<(userId: string, hash: string, now: Date) => Promise<boolean>>();
const issueCode = vi.fn<(userId: string, channel: BadgeChannel, hash: string, now: Date) => Promise<IssuedCheck | null>>();
const confirm = vi.fn<(userId: string, by: string, now: Date, beforeRegained?: (tx: unknown) => Promise<unknown>) => Promise<Badge | null>>();
const remove =
  vi.fn<
    (
      userId: string,
      by: string,
      kind: 'fail' | 'withdrawn',
      reason: string,
      now: Date,
      whenWithdrawn?: (tx: unknown) => Promise<unknown>
    ) => Promise<RemovedCheck | null>
  >();
const narrowLinksOf = vi.fn<(professionalId: string, now: Date, tx: unknown) => Promise<number>>();
const queue = vi.fn<() => Promise<readonly BadgeQueueRow[]>>();
const lapseOverdue = vi.fn<(now: Date) => Promise<readonly LapsedBadge[]>>();
const dueWithin = vi.fn<(since: Date, now: Date) => Promise<readonly DueBadge[]>>();
const dueCounts = vi.fn<(now: Date, soonDays: number) => Promise<{ due: number; soon: number }>>();
const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const isEnabled = vi.fn<(key: string, fallback: boolean) => Promise<boolean>>();

vi.mock('#repositories/Professional', async importOriginal => {
  const actual = await importOriginal<typeof Repositories>();

  return {
    ...actual,
    ProfessionalBadgeRepository: {
      apply: (userId: string, input: unknown, now: Date) => apply(userId, input, now),
      confirm: (userId: string, by: string, now: Date, beforeRegained?: (tx: unknown) => Promise<unknown>) =>
        confirm(userId, by, now, beforeRegained),
      dueCounts: (now: Date, soonDays: number) => dueCounts(now, soonDays),
      dueWithin: (since: Date, now: Date) => dueWithin(since, now),
      enterCode: (userId: string, hash: string, now: Date) => enterCode(userId, hash, now),
      issueCode: (userId: string, channel: BadgeChannel, hash: string, now: Date) => issueCode(userId, channel, hash, now),
      lapseOverdue: (now: Date) => lapseOverdue(now),
      queue: () => queue(),
      record: (userId: string) => record(userId),
      remove: (
        userId: string,
        by: string,
        kind: 'fail' | 'withdrawn',
        reason: string,
        now: Date,
        whenWithdrawn?: (tx: unknown) => Promise<unknown>
      ) => remove(userId, by, kind, reason, now, whenWithdrawn)
    }
  };
});
vi.mock('#repositories/Care', () => ({
  CareRepository: { narrowLinksOf: (professionalId: string, now: Date, tx: unknown) => narrowLinksOf(professionalId, now, tx) }
}));
vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findById(id) } }));
const lastOwnerAlert = vi.fn<(kind: string) => Promise<Date | null>>();
const claimOwnerAlert = vi.fn<(kind: string, since: Date, at?: Date) => Promise<string | null>>();

vi.mock('#repositories/Analytics', () => ({
  AnalyticsRepository: {
    claimOwnerAlert: (kind: string, since: Date, at?: Date) => claimOwnerAlert(kind, since, at),
    lastOwnerAlert: (kind: string) => lastOwnerAlert(kind)
  }
}));
vi.mock('#repositories/Settings', () => ({ SettingsRepository: { isEnabled: (key: string, fallback: boolean) => isEnabled(key, fallback) } }));

let sequence = 0;

function check(kind: ProfessionalBadgeCheck['kind'], days: number, overrides: Partial<ProfessionalBadgeCheck> = {}): ProfessionalBadgeCheck {
  sequence += 1;
  const at = new Date(NOW.getTime() - days * DAY);
  const due = new Date(at.getTime());

  due.setUTCMonth(due.getUTCMonth() + 12);

  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    channel: kind === 'pass' ? 'post' : null,
    checkedAt: at,
    checkedBy: kind === 'applied' || kind === 'lapsed' ? null : 'usr-owner',
    createdAt: new Date(at.getTime() + sequence),
    dueAt: kind === 'pass' ? due : null,
    kind,
    number: 'MAD00123',
    reason: ['fail', 'withdrawn', 'lapsed'].includes(kind) ? 'not_me' : null,
    register: 'Colegio de Madrid',
    updatedAt: at,
    userId: 'usr-pro',
    ...overrides
  };
}

function code(checkId: string, overrides: Partial<ProfessionalBadgeCode> = {}): ProfessionalBadgeCode {
  return {
    id: '00000000-0000-4000-8000-0000000000ff',
    attempts: 0,
    channel: 'post',
    checkId,
    codeHash: 'secret-hash',
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 30 * DAY),
    updatedAt: NOW,
    usedAt: null,
    userId: 'usr-pro',
    ...overrides
  };
}

beforeEach(() => {
  for (const mock of [
    record,
    apply,
    enterCode,
    issueCode,
    confirm,
    remove,
    narrowLinksOf,
    queue,
    lapseOverdue,
    dueWithin,
    dueCounts,
    findById,
    isEnabled,
    lastOwnerAlert,
    claimOwnerAlert
  ]) {
    mock.mockReset();
  }

  findById.mockResolvedValue(makeUser({ id: 'usr-pro', email: 'pro@example.invalid', name: 'Ana Pérez' }));
});

describe('ProfessionalBadgeController.state — the six states', () => {
  it('is none with no record', async () => {
    record.mockResolvedValue({ checks: [], code: null });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({ decision: null, number: null, state: 'none' });
  });

  /*
   * The invariant review of phase 3, P1-2: the statement of reasons is mailed
   * once; the practitioner's own page must say it too, whatever became of the
   * mail.
   */
  it('reads a refusal and a withdrawal as what they are, with the reason and the owner’s facts', async () => {
    const fail = check('fail', 1, { reason: 'not_me: Lo dijo por teléfono.' });
    const withdrawn = check('withdrawn', 2, { reason: 'not_on_register' });

    record.mockResolvedValueOnce({ checks: [fail, check('applied', 5)], code: null });
    record.mockResolvedValueOnce({ checks: [check('pass', 30), withdrawn], code: null });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({
      decision: { at: fail.checkedAt.toISOString(), facts: 'Lo dijo por teléfono.', kind: 'fail', reason: 'not_me' },
      state: 'refused'
    });
    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({
      decision: { at: withdrawn.checkedAt.toISOString(), facts: null, kind: 'withdrawn', reason: 'not_on_register' },
      number: null,
      state: 'withdrawn'
    });
  });

  it('keeps an unknown stored reason out of the closed field', async () => {
    record.mockResolvedValue({ checks: [check('fail', 1, { reason: 'something else' })], code: null });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({ decision: { facts: null, reason: null } });
  });

  it('is applied again once a new application follows a refusal', async () => {
    record.mockResolvedValue({ checks: [check('applied', 5), check('fail', 3), check('applied', 1)], code: null });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({ state: 'applied' });
  });

  it('is applied while the application waits with no code out — and never shows the declared number back', async () => {
    record.mockResolvedValue({ checks: [check('applied', 1)], code: null });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toEqual({
      checkedAt: null,
      codeEntered: false,
      codeExpiresAt: null,
      decision: null,
      dueAt: null,
      lapsesAt: null,
      number: null,
      register: 'Colegio de Madrid',
      state: 'applied'
    });
  });

  it('is code sent while the application’s code is live, and says when it was entered', async () => {
    const applied = check('applied', 1);

    record.mockResolvedValueOnce({ checks: [applied], code: code(applied.id) });
    record.mockResolvedValueOnce({ checks: [applied], code: code(applied.id, { usedAt: NOW }) });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({
      codeEntered: false,
      codeExpiresAt: new Date(NOW.getTime() + 30 * DAY).toISOString(),
      state: 'code_sent'
    });
    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({
      codeEntered: true,
      codeExpiresAt: null,
      state: 'code_sent'
    });
  });

  it('goes back to applied when the code expired or ran out of tries', async () => {
    const applied = check('applied', 1);

    record.mockResolvedValue({ checks: [applied], code: code(applied.id, { attempts: 5 }) });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({ state: 'applied' });
  });

  it('is badged with the checked number, then due, then lapsed by date alone', async () => {
    const pass = check('pass', 10);

    record.mockResolvedValue({ checks: [check('applied', 20), pass], code: null });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({ number: 'MAD00123', state: 'badged' });
    await expect(ProfessionalBadgeController.state('usr-pro', new Date((pass.dueAt as Date).getTime() + DAY))).resolves.toMatchObject({
      state: 'due'
    });
    // Past the grace, with no `lapsed` row yet: the badge is derived, so it is gone already, and reads as the lapse it is.
    await expect(ProfessionalBadgeController.state('usr-pro', new Date((pass.dueAt as Date).getTime() + 31 * DAY))).resolves.toMatchObject({
      decision: { at: new Date((pass.dueAt as Date).getTime() + 30 * DAY).toISOString(), kind: 'lapsed', reason: null },
      number: null,
      state: 'lapsed'
    });
  });

  it('is lapsed once the sweep wrote it', async () => {
    record.mockResolvedValue({ checks: [check('pass', 400), check('lapsed', 1)], code: null });

    await expect(ProfessionalBadgeController.state('usr-pro', NOW)).resolves.toMatchObject({ number: null, state: 'lapsed' });
  });

  it('never carries the code, its hash or who checked', async () => {
    const pass = check('pass', 10);

    record.mockResolvedValue({ checks: [pass], code: code(pass.id) });

    const view = JSON.stringify(await ProfessionalBadgeController.state('usr-pro', NOW));

    expect(view).not.toContain('secret-hash');
    expect(view).not.toContain('usr-owner');
  });
});

describe('ProfessionalBadgeController.apply and enterCode', () => {
  it('is a 404 while a badge stands', async () => {
    apply.mockResolvedValue(false);

    await expect(ProfessionalBadgeController.apply('usr-pro', { number: 'MAD00123', register: 'Madrid' }, NOW)).rejects.toThrow(NotFoundError);
  });

  it('answers the badge as it now stands', async () => {
    apply.mockResolvedValue(true);
    record.mockResolvedValue({ checks: [check('applied', 0)], code: null });

    await expect(ProfessionalBadgeController.apply('usr-pro', { number: 'MAD00123', register: 'Madrid' }, NOW)).resolves.toMatchObject({
      state: 'applied'
    });
    expect(apply).toHaveBeenCalledWith('usr-pro', { number: 'MAD00123', register: 'Madrid' }, NOW);
  });

  it('hands the store the code’s hash, never the code, ignoring case and separators', async () => {
    enterCode.mockResolvedValue(true);

    await ProfessionalBadgeController.enterCode('usr-pro', { code: ' abcde-fghjk ' }, NOW);

    expect(enterCode).toHaveBeenCalledWith('usr-pro', badgeCodeHash('ABCDEFGHJK'), NOW);
    expect(enterCode.mock.calls[0]?.[1]).not.toContain('ABCDE');
  });

  it('is the same 404 for every refusal, in the guard’s own words', async () => {
    enterCode.mockResolvedValue(false);
    apply.mockResolvedValue(false);

    await expect(ProfessionalBadgeController.enterCode('usr-pro', { code: 'anything' }, NOW)).rejects.toThrow(new NotFoundError('Not Found'));
    await expect(ProfessionalBadgeController.apply('usr-pro', { number: 'MAD00123', register: 'Madrid' }, NOW)).rejects.toThrow(
      new NotFoundError('Not Found')
    );
  });
});

describe('newBadgeCode', () => {
  it('is ten unambiguous symbols in two groups, different every time', () => {
    const codes = new Set(Array.from({ length: 50 }, () => newBadgeCode()));

    for (const value of codes) {
      expect(value).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
    }

    expect(codes.size).toBe(50);
  });
});

describe('ProfessionalBadgeController.issueCode', () => {
  it('stores a hash and hands the code back once, with what it proves', async () => {
    issueCode.mockResolvedValue({ expiresAt: new Date(NOW.getTime() + 30 * DAY), number: 'MAD00123', register: 'Colegio de Madrid' });

    const issued = await ProfessionalBadgeController.issueCode('usr-pro', { channel: 'post' }, NOW);

    expect(issued).toMatchObject({ channel: 'post', number: 'MAD00123', register: 'Colegio de Madrid', userId: 'usr-pro' });
    expect(issueCode).toHaveBeenCalledWith('usr-pro', 'post', badgeCodeHash(issued.code), NOW);
    expect(issueCode.mock.calls[0]?.[2]).not.toBe(issued.code);
  });

  it('is a 404 for an account that does not exist, and stores nothing', async () => {
    findById.mockResolvedValue(undefined);

    await expect(ProfessionalBadgeController.issueCode('usr-nobody', { channel: 'phone' }, NOW)).rejects.toThrow(NotFoundError);
    expect(issueCode).not.toHaveBeenCalled();
  });

  it('is a 404 when there is nothing to prove', async () => {
    issueCode.mockResolvedValue(null);

    await expect(ProfessionalBadgeController.issueCode('usr-pro', { channel: 'phone' }, NOW)).rejects.toThrow(NotFoundError);
  });
});

describe('ProfessionalBadgeController.confirm, remove and record', () => {
  it('confirms as the owner and answers the record without who checked or any hash', async () => {
    const pass = check('pass', 0);

    confirm.mockResolvedValue({
      channel: 'post',
      checkedAt: NOW,
      checkId: pass.id,
      dueAt: pass.dueAt as Date,
      lapsesAt: new Date(NOW.getTime() + 395 * DAY),
      number: 'MAD00123',
      register: 'Colegio de Madrid'
    });
    record.mockResolvedValue({ checks: [pass, check('applied', 3)], code: code(pass.id, { usedAt: NOW }) });

    const view = await ProfessionalBadgeController.confirm('usr-pro', 'usr-owner', NOW);

    expect(confirm).toHaveBeenCalledWith('usr-pro', 'usr-owner', NOW, expect.any(Function));
    expect(view).toMatchObject({ application: null, email: 'pro@example.invalid', name: 'Ana Pérez', state: 'badged', userId: 'usr-pro' });
    expect(Object.keys(view.checks[0] ?? {}).sort()).toEqual(['channel', 'checkedAt', 'dueAt', 'kind', 'number', 'reason', 'register']);
    expect(JSON.stringify(view)).not.toContain('secret-hash');
    expect(JSON.stringify(view)).not.toContain('usr-owner');
  });

  it('is a 404 when there is no entered code and no badge to renew', async () => {
    confirm.mockResolvedValue(null);

    await expect(ProfessionalBadgeController.confirm('usr-pro', 'usr-owner', NOW)).rejects.toThrow(NotFoundError);
  });

  it('stores the closed reason with the owner’s facts after it, and returns what the statement cites', async () => {
    remove.mockResolvedValue({ checkedAt: NOW, kind: 'withdrawn', number: 'MAD00123', register: 'Colegio de Madrid' });
    record.mockResolvedValue({ checks: [check('withdrawn', 0)], code: null });

    const removal = await ProfessionalBadgeController.remove(
      'usr-pro',
      'usr-owner',
      { facts: 'El colegio lo confirmó por escrito.', kind: 'withdrawn', reason: 'not_on_register', source: 'notice' },
      NOW
    );

    expect(remove).toHaveBeenCalledWith(
      'usr-pro',
      'usr-owner',
      'withdrawn',
      'not_on_register: El colegio lo confirmó por escrito.',
      NOW,
      expect.any(Function)
    );
    expect(removal).toMatchObject({ kind: 'withdrawn', reason: 'not_on_register', source: 'notice', to: 'pro@example.invalid' });
  });

  /*
   * Project 025 phase 5 (review round one, P2-3): a badge taken back narrows the
   * practitioner's links in the owner's own transaction, so a badge granted again
   * widens nothing until each client consents afresh.
   */
  it('hands the confirmation a narrowing of that practitioner’s links, for a badge that comes back', async () => {
    const TX = { name: 'the confirmation’s transaction' };

    confirm.mockImplementation(async (_userId, _by, now, beforeRegained) => {
      await beforeRegained?.(TX);

      return { channel: null, checkedAt: now, checkId: 'c', dueAt: now, lapsesAt: now, number: 'MAD00123', register: 'Colegio de Madrid' };
    });
    narrowLinksOf.mockResolvedValue(1);
    record.mockResolvedValue({ checks: [check('pass', 0)], code: null });

    await ProfessionalBadgeController.confirm('usr-pro', 'usr-owner', NOW);

    expect(narrowLinksOf).toHaveBeenCalledExactlyOnceWith('usr-pro', NOW, TX);
  });

  it('hands the removal a narrowing of that practitioner’s links, to run in its own transaction', async () => {
    const TX = { name: 'the removal’s transaction' };

    remove.mockImplementation(async (_userId, _by, _kind, _reason, _now, whenWithdrawn) => {
      await whenWithdrawn?.(TX);

      return { checkedAt: NOW, kind: 'withdrawn', number: 'MAD00123', register: 'Colegio de Madrid' };
    });
    narrowLinksOf.mockResolvedValue(2);
    record.mockResolvedValue({ checks: [check('withdrawn', 0)], code: null });

    await ProfessionalBadgeController.remove('usr-pro', 'usr-owner', { kind: 'withdrawn', reason: 'not_on_register', source: 'notice' }, NOW);

    // The practitioner whose badge went — never anybody the caller names — and nobody is mailed for it.
    expect(narrowLinksOf).toHaveBeenCalledExactlyOnceWith('usr-pro', NOW, TX);
  });

  it('is a 404 when there is nothing of that kind to decide', async () => {
    remove.mockResolvedValue(null);

    await expect(
      ProfessionalBadgeController.remove('usr-pro', 'usr-owner', { kind: 'fail', reason: 'not_me', source: 'own_check' }, NOW)
    ).rejects.toThrow(NotFoundError);
  });

  it('shows the owner the declared register and number while the application waits', async () => {
    const applied = check('applied', 2, { number: 'CV-0456', register: 'Colegio Valenciano' });

    record.mockResolvedValue({ checks: [applied], code: code(applied.id) });

    await expect(ProfessionalBadgeController.record('usr-pro', NOW)).resolves.toMatchObject({
      application: { appliedAt: applied.checkedAt.toISOString(), number: 'CV-0456', register: 'Colegio Valenciano' },
      badge: null,
      code: { channel: 'post', entered: false, live: true },
      state: 'code_sent'
    });
  });

  it('is a 404 for an account that does not exist', async () => {
    findById.mockResolvedValue(undefined);

    await expect(ProfessionalBadgeController.record('usr-nobody', NOW)).rejects.toThrow(NotFoundError);
  });
});

describe('ProfessionalBadgeController.queue', () => {
  it('lists applications waiting and badges due, soonest lapse first, without their history', async () => {
    const row = (userId: string, checks: ProfessionalBadgeCheck[]): BadgeQueueRow => ({
      checks,
      code: null,
      email: `${userId}@example.invalid`,
      name: userId,
      userId
    });

    queue.mockResolvedValue([
      row('usr-applied', [check('applied', 1, { userId: 'usr-applied' })]),
      row('usr-fresh', [check('pass', 10, { userId: 'usr-fresh' })]),
      row('usr-due-late', [check('pass', 370, { userId: 'usr-due-late' })]),
      row('usr-due-early', [check('pass', 380, { userId: 'usr-due-early' })]),
      row('usr-gone', [check('pass', 500, { userId: 'usr-gone' })])
    ]);

    const view = await ProfessionalBadgeController.queue(NOW);

    expect(view.applications.map(entry => entry.userId)).toEqual(['usr-applied']);
    expect(view.due.map(entry => entry.userId)).toEqual(['usr-due-early', 'usr-due-late']);
    expect(view.due[0]).not.toHaveProperty('checks');
  });
});

describe('ProfessionalBadgeController.sweep', () => {
  it('does nothing at all while the `professional` switch is off', async () => {
    isEnabled.mockResolvedValue(false);

    await expect(ProfessionalBadgeController.sweep(NOW)).resolves.toBeNull();
    expect(isEnabled).toHaveBeenCalledWith('professional', false);
    expect(lapseOverdue).not.toHaveBeenCalled();
    expect(dueWithin).not.toHaveBeenCalled();
  });

  it('lapses first, then finds the re-checks due since the last reminding pass and the counts, with each practitioner’s own address', async () => {
    const mark = new Date(NOW.getTime() - 3 * DAY);

    isEnabled.mockResolvedValue(true);
    lastOwnerAlert.mockResolvedValue(mark);
    claimOwnerAlert.mockResolvedValue('claim-1');
    lapseOverdue.mockResolvedValue([{ detail: 'our_delay', dueAt: new Date(NOW.getTime() - 30 * DAY), userId: 'usr-pro' }]);
    dueWithin.mockResolvedValue([{ lapsesAt: new Date(NOW.getTime() + 30 * DAY), register: null, userId: 'usr-gone' }]);
    dueCounts.mockResolvedValue({ due: 3, soon: 1 });
    findById.mockImplementation(async id => (id === 'usr-pro' ? makeUser({ id, email: 'pro@example.invalid' }) : undefined));

    const sweep = await ProfessionalBadgeController.sweep(NOW);

    // A missed day is reminded late: the window starts at the watermark, three days back, and moves it to now.
    expect(lastOwnerAlert).toHaveBeenCalledWith('badge-reminders');
    expect(claimOwnerAlert).toHaveBeenCalledWith('badge-reminders', new Date(mark.getTime() + 1), NOW);
    expect(dueWithin).toHaveBeenCalledWith(mark, NOW);
    expect(dueCounts).toHaveBeenCalledWith(NOW, 7);
    expect(sweep).toEqual({
      counts: { due: 3, soon: 1 },
      lapsed: [{ detail: 'our_delay', dueAt: new Date(NOW.getTime() - 30 * DAY), to: 'pro@example.invalid', userId: 'usr-pro' }],
      // An account deleted since is nobody to mail.
      reminders: []
    });
    expect(lapseOverdue.mock.invocationCallOrder[0]).toBeLessThan(dueWithin.mock.invocationCallOrder[0] ?? 0);
  });

  it('reminds nobody when another pass moved the watermark first, and still lapses and counts', async () => {
    isEnabled.mockResolvedValue(true);
    lastOwnerAlert.mockResolvedValue(new Date(NOW.getTime() - DAY));
    claimOwnerAlert.mockResolvedValue(null);
    lapseOverdue.mockResolvedValue([]);
    dueCounts.mockResolvedValue({ due: 1, soon: 0 });

    await expect(ProfessionalBadgeController.sweep(NOW)).resolves.toEqual({ counts: { due: 1, soon: 0 }, lapsed: [], reminders: [] });
    expect(dueWithin).not.toHaveBeenCalled();
  });

  it('reminds the last day’s re-checks on the very first pass, with no watermark yet', async () => {
    isEnabled.mockResolvedValue(true);
    lastOwnerAlert.mockResolvedValue(null);
    claimOwnerAlert.mockResolvedValue('claim-1');
    lapseOverdue.mockResolvedValue([]);
    dueWithin.mockResolvedValue([]);
    dueCounts.mockResolvedValue({ due: 0, soon: 0 });

    await ProfessionalBadgeController.sweep(NOW);

    expect(claimOwnerAlert).toHaveBeenCalledWith('badge-reminders', new Date(1), NOW);
    expect(dueWithin).toHaveBeenCalledWith(new Date(NOW.getTime() - DAY), NOW);
  });
});
