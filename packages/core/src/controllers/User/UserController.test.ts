import { beforeEach, describe, expect, it, vi } from 'vitest';

import { accountQuerySchema } from 'core/entities/AdminQuery';
import { makeUser } from '#test/fixtures';
import { UNAUDITED } from 'core/entities/Audit';

import { UserController } from './UserController';

import type { AccountQuery } from 'core/entities/AdminQuery';
import type { AccountRow } from '#repositories/User';
import type { User, UserTier } from 'core/entities/User';

const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const findAll = vi.fn<(query: AccountQuery) => Promise<{ rows: readonly AccountRow[]; total: number }>>();
const activate =
  vi.fn<
    (match: { id?: string; email?: string }, record?: (tx: unknown, subjectUserId: string) => Promise<void>) => Promise<{ email: string } | null>
  >();
const setTier = vi.fn<(id: string, tier: UserTier, record?: (tx: unknown, from: UserTier) => Promise<void>) => Promise<{ email: string } | null>>();
const record = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();
const forgetExpiredVerifications = vi.fn<(now: Date) => Promise<number>>();
const hasPassword = vi.fn<(id: string) => Promise<boolean>>();
const markPasswordCompromised = vi.fn<(id: string, at: Date) => Promise<boolean>>();
const forgetTrustedDevices = vi.fn<(id: string) => Promise<number>>();
const forgetSignInDevices = vi.fn<(id: string) => Promise<number>>();
const passwordChanged = vi.fn<(id: string, record: (tx: unknown, passkeysRemoved: number) => Promise<void>) => Promise<number>>();
const forgetPasskeys = vi.fn<(id: string, record: (tx: unknown, passkeysRemoved: number) => Promise<void>) => Promise<number>>();
const confirmAddressByReset = vi.fn<(id: string) => Promise<boolean>>();
const spendGrant = vi.fn<(identifier: string, id: string, now: Date) => Promise<boolean>>();
const deleteStaleUnconfirmed = vi.fn<(cutoff: Date, record: (tx: unknown, id: string) => Promise<void>) => Promise<readonly string[]>>();

vi.mock('#repositories/User', () => ({
  UserRepository: {
    activate: (match: { id?: string; email?: string }, r?: (tx: unknown, subjectUserId: string) => Promise<void>) => activate(match, r),
    confirmAddressByReset: (id: string) => confirmAddressByReset(id),
    deleteStaleUnconfirmed: (cutoff: Date, r: (tx: unknown, id: string) => Promise<void>) => deleteStaleUnconfirmed(cutoff, r),
    findAll: (query: AccountQuery) => findAll(query),
    findById: (id: string) => findById(id),
    forgetExpiredVerifications: (now: Date) => forgetExpiredVerifications(now),
    forgetPasskeys: (id: string, r: (tx: unknown, passkeysRemoved: number) => Promise<void>) => forgetPasskeys(id, r),
    forgetTrustedDevices: (id: string) => forgetTrustedDevices(id),
    hasPassword: (id: string) => hasPassword(id),
    markPasswordCompromised: (id: string, at: Date) => markPasswordCompromised(id, at),
    passwordChanged: (id: string, r: (tx: unknown, passkeysRemoved: number) => Promise<void>) => passwordChanged(id, r),
    setTier: (id: string, tier: UserTier, r?: (tx: unknown, from: UserTier) => Promise<void>) => setTier(id, tier, r),
    spendGrant: (identifier: string, id: string, now: Date) => spendGrant(identifier, id, now)
  }
}));
vi.mock('#repositories/SignInDevice', () => ({ SignInDeviceRepository: { forgetAll: (id: string) => forgetSignInDevices(id) } }));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => record(entry, tx) } }));

/*
 * The account view is what every gate in the web app reads. It carried only
 * `emailVerified`, so the app shell asked about the address and let a
 * confirmed-but-unopened account in (`0030`). These two cases are that bug.
 */
describe('UserController.getUser — activation is not the address', () => {
  beforeEach(() => {
    findById.mockReset();
    hasPassword.mockReset();
    hasPassword.mockResolvedValue(true);
  });

  it('reports a confirmed address the owner has not opened as not activated', async () => {
    findById.mockResolvedValue(makeUser({ activatedAt: null, emailVerified: true }));

    await expect(UserController.getUser({ id: 'usr-1' })).resolves.toMatchObject({ activated: false, emailVerified: true });
  });

  it('reports an opened account as activated even before the address is confirmed', async () => {
    findById.mockResolvedValue(makeUser({ activatedAt: new Date('2026-09-09T21:00:00.000Z'), emailVerified: false }));

    await expect(UserController.getUser({ id: 'usr-1' })).resolves.toMatchObject({ activated: true, emailVerified: false });
  });
});

/*
 * PLAN 011 phase 2: what the "Seguridad" section and the forced-change screen
 * read — whether there is a password to change, and whether it must be.
 */
describe('UserController.getUser — the password', () => {
  beforeEach(() => {
    findById.mockReset();
    hasPassword.mockReset();
  });

  it('says a Google-only account has no password, asked of the session’s own id', async () => {
    findById.mockResolvedValue(makeUser());
    hasPassword.mockResolvedValue(false);

    await expect(UserController.getUser({ id: 'usr-1' })).resolves.toMatchObject({ hasPassword: false, passwordChangeRequired: false });
    expect(hasPassword).toHaveBeenCalledWith('usr-1');
  });

  it('asks for a change while the breach mark is set, and says only that — never when', async () => {
    findById.mockResolvedValue(makeUser({ passwordCompromisedAt: new Date('2026-10-01T08:00:00.000Z') }));
    hasPassword.mockResolvedValue(true);

    const view = await UserController.getUser({ id: 'usr-1' });

    expect(view).toMatchObject({ hasPassword: true, passwordChangeRequired: true });
    expect(view).not.toHaveProperty('passwordCompromisedAt');
  });

  it('says whether the second factor is on, as the row has it', async () => {
    findById.mockResolvedValue(makeUser({ twoFactorEnabled: true }));
    hasPassword.mockResolvedValue(true);

    await expect(UserController.getUser({ id: 'usr-1' })).resolves.toMatchObject({ twoFactorEnabled: true });
  });
});

describe('UserController.passwordChanged', () => {
  beforeEach(() => {
    passwordChanged.mockReset();
    record.mockReset();
    passwordChanged.mockImplementation(async (_id, r) => {
      await r('tx-1', 0);

      return 0;
    });
  });

  it.each(['change', 'reset'] as const)(
    'clears the mark and writes one auth.password_changed row {via: %s} inside the same transaction',
    async via => {
      await UserController.passwordChanged('usr-1', via);

      expect(passwordChanged).toHaveBeenCalledWith('usr-1', expect.any(Function));
      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(
        { action: 'auth.password_changed', actorId: 'usr-1', entity: 'user', metadata: { via }, subjectUserId: 'usr-1' },
        'tx-1'
      );
    }
  );
});

describe.each(['change', 'reset'] as const)('UserController.passwordChanged {via: %s}, which removed passkeys', via => {
  beforeEach(() => {
    passwordChanged.mockReset();
    record.mockReset();
    passwordChanged.mockImplementation(async (_id, r) => {
      await r('tx-1', 2);

      return 2;
    });
  });

  it('writes one auth.passkey_removed row per passkey, with nothing in it, in the same transaction, and says how many went', async () => {
    await expect(UserController.passwordChanged('usr-1', via)).resolves.toBe(2);

    expect(record).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenNthCalledWith(
      2,
      { action: 'auth.passkey_removed', actorId: 'usr-1', entity: 'passkey', metadata: {}, subjectUserId: 'usr-1' },
      'tx-1'
    );
    expect(record).toHaveBeenNthCalledWith(
      3,
      { action: 'auth.passkey_removed', actorId: 'usr-1', entity: 'passkey', metadata: {}, subjectUserId: 'usr-1' },
      'tx-1'
    );
  });
});

describe('UserController.forgetPasskeys', () => {
  beforeEach(() => {
    forgetPasskeys.mockReset();
    record.mockReset();
  });

  it('removes the account’s passkeys with one auth.passkey_removed row each, in that transaction, and no password row', async () => {
    forgetPasskeys.mockImplementation(async (_id, r) => {
      await r('tx-2', 2);

      return 2;
    });

    await expect(UserController.forgetPasskeys('usr-1')).resolves.toBe(2);

    expect(forgetPasskeys).toHaveBeenCalledWith('usr-1', expect.any(Function));
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledWith(
      { action: 'auth.passkey_removed', actorId: 'usr-1', entity: 'passkey', metadata: {}, subjectUserId: 'usr-1' },
      'tx-2'
    );
  });

  it('writes nothing when the account had none', async () => {
    forgetPasskeys.mockImplementation(async (_id, r) => {
      await r('tx-2', 0);

      return 0;
    });

    await expect(UserController.forgetPasskeys('usr-1')).resolves.toBe(0);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('UserController.confirmAddressByReset', () => {
  it('answers whether the reset was what confirmed the address', async () => {
    confirmAddressByReset.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(UserController.confirmAddressByReset('usr-1')).resolves.toBe(true);
    await expect(UserController.confirmAddressByReset('usr-1')).resolves.toBe(false);
    expect(confirmAddressByReset).toHaveBeenCalledWith('usr-1');
  });
});

describe('UserController.spendGrant', () => {
  beforeEach(() => {
    spendGrant.mockReset();
  });

  it('asks the repository to spend that grant of that account, as of now, and says whether it did', async () => {
    spendGrant.mockResolvedValue(true);

    await expect(UserController.spendGrant('passkey-grant-s1', 'usr-1')).resolves.toBe(true);
    expect(spendGrant).toHaveBeenCalledWith('passkey-grant-s1', 'usr-1', expect.any(Date));

    spendGrant.mockResolvedValue(false);

    await expect(UserController.spendGrant('passkey-grant-s1', 'usr-1')).resolves.toBe(false);
  });
});

describe('UserController.sessionsRevoked', () => {
  beforeEach(() => {
    record.mockReset();
    forgetTrustedDevices.mockReset();
    forgetSignInDevices.mockReset();
  });

  it('stops trusting the account’s devices when others or all sessions close, not when one does', async () => {
    await UserController.sessionsRevoked('usr-1', 'one');
    await UserController.sessionsRevoked('usr-1', 'others');
    await UserController.sessionsRevoked('usr-1', 'all');

    expect(forgetTrustedDevices.mock.calls).toEqual([['usr-1'], ['usr-1']]);
  });

  it('ends the account’s sign-in device cookies under the same rule (PLAN 011 phase 7b): a lost laptop’s browser goes with its sessions', async () => {
    await UserController.sessionsRevoked('usr-1', 'one');
    await UserController.sessionsRevoked('usr-1', 'others');
    await UserController.sessionsRevoked('usr-1', 'all');

    expect(forgetSignInDevices.mock.calls).toEqual([['usr-1'], ['usr-1']]);
  });

  it.each(['one', 'others', 'all'] as const)('writes one auth.sessions_revoked row {scope: %s}, the scope and nothing else', async scope => {
    await UserController.sessionsRevoked('usr-1', scope);

    expect(record).toHaveBeenCalledWith(
      { action: 'auth.sessions_revoked', actorId: 'usr-1', entity: 'session', metadata: { scope }, subjectUserId: 'usr-1' },
      undefined
    );
  });
});

describe('UserController.forgetDevices', () => {
  beforeEach(() => {
    forgetTrustedDevices.mockReset();
    forgetSignInDevices.mockReset();
  });

  it('ends both kinds of device row of the account being deleted, by its own id', async () => {
    await UserController.forgetDevices('usr-1');

    expect(forgetTrustedDevices.mock.calls).toEqual([['usr-1']]);
    expect(forgetSignInDevices.mock.calls).toEqual([['usr-1']]);
  });
});

describe('UserController.twoFactorChanged', () => {
  beforeEach(() => {
    record.mockReset();
    forgetTrustedDevices.mockReset();
  });

  it('stops trusting the account’s devices when the factor goes off, and only then', async () => {
    await UserController.twoFactorChanged('usr-1', false);
    await UserController.twoFactorChanged('usr-1', true);

    expect(forgetTrustedDevices).toHaveBeenCalledTimes(1);
    expect(forgetTrustedDevices).toHaveBeenCalledWith('usr-1');
  });

  it.each([
    [true, 'auth.2fa_enabled'],
    [false, 'auth.2fa_disabled']
  ] as const)('writes one row with nothing in its metadata when the factor goes %s', async (enabled, action) => {
    await UserController.twoFactorChanged('usr-1', enabled);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({ action, actorId: 'usr-1', entity: 'user', metadata: {}, subjectUserId: 'usr-1' }, undefined);
  });
});

describe('UserController.passkeyChanged', () => {
  beforeEach(() => {
    record.mockReset();
    forgetTrustedDevices.mockReset();
  });

  it.each([
    [true, 'auth.passkey_added'],
    [false, 'auth.passkey_removed']
  ] as const)('writes one row with nothing in its metadata when a passkey is added: %s', async (added, action) => {
    await UserController.passkeyChanged('usr-1', added);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({ action, actorId: 'usr-1', entity: 'passkey', metadata: {}, subjectUserId: 'usr-1' }, undefined);
    expect(forgetTrustedDevices).not.toHaveBeenCalled();
  });
});

describe('UserController.backupCodesRegenerated', () => {
  beforeEach(() => {
    record.mockReset();
  });

  it('writes one auth.backup_codes_regenerated row with nothing in its metadata', async () => {
    await UserController.backupCodesRegenerated('usr-1');

    expect(record).toHaveBeenCalledWith(
      { action: 'auth.backup_codes_regenerated', actorId: 'usr-1', entity: 'user', metadata: {}, subjectUserId: 'usr-1' },
      undefined
    );
  });
});

describe('UserController.backupCodeUsed', () => {
  beforeEach(() => {
    record.mockReset();
  });

  it('writes one auth.backup_code_used row with the count left and nothing else', async () => {
    await UserController.backupCodeUsed('usr-1', 9);

    expect(record).toHaveBeenCalledWith(
      { action: 'auth.backup_code_used', actorId: 'usr-1', entity: 'user', metadata: { remaining: 9 }, subjectUserId: 'usr-1' },
      undefined
    );
  });
});

describe('UserController.markPasswordCompromised', () => {
  it('marks the account at the instant given, and answers whether this call set it', async () => {
    const at = new Date('2026-10-01T08:00:00.000Z');
    markPasswordCompromised.mockResolvedValue(false);

    await expect(UserController.markPasswordCompromised('usr-1', at)).resolves.toBe(false);
    expect(markPasswordCompromised).toHaveBeenCalledWith('usr-1', at);
  });
});

const ROW: AccountRow = {
  id: 'usr-7',
  activatedAt: new Date('2026-09-10T08:00:00.000Z'),
  createdAt: new Date('2026-09-09T21:00:00.000Z'),
  email: 'ana@example.invalid',
  emailVerified: true,
  lastActiveAt: new Date('2026-09-27T18:30:00.000Z'),
  onboardedAt: '2026-09-11',
  plans: 2,
  professional: false,
  role: 'user',
  tier: 'free',
  twoFactorEnabled: true,
  twoFactorRemovalDueAt: new Date('2026-10-03T19:00:00.000Z')
};

/*
 * The owner's account table (`0028`, `0068`): the row's own facts and four
 * milestones — dates and counts about the account, never what it holds.
 */
describe('UserController.accounts', () => {
  beforeEach(() => {
    findAll.mockReset();
    findAll.mockResolvedValue({ rows: [ROW], total: 41 });
  });

  it('asks for the newest 25 first when nothing is asked, as the list always did', async () => {
    const page = await UserController.accounts();

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ dir: 'desc', offset: 0, size: 25, sort: 'createdAt' }));
    expect(page).toMatchObject({ offset: 0, size: 25, total: 41 });
  });

  it('passes the query through and answers with the page it was asked for', async () => {
    const query = accountQuerySchema.parse({ activated: 'no', offset: '50', size: '50', sort: 'plans' });
    const page = await UserController.accounts(query);

    expect(findAll).toHaveBeenCalledWith(query);
    expect(page).toMatchObject({ offset: 50, size: 50, total: 41 });
  });

  it('presents each milestone as a date or a count, and nothing else', async () => {
    const { rows } = await UserController.accounts();

    expect(rows[0]).toEqual({
      id: 'usr-7',
      activated: true,
      createdAt: '2026-09-09T21:00:00.000Z',
      email: 'ana@example.invalid',
      emailVerified: true,
      lastActiveAt: '2026-09-27T18:30:00.000Z',
      onboardedAt: '2026-09-11',
      plans: 2,
      professional: false,
      role: 'user',
      tier: 'free',
      twoFactorEnabled: true,
      twoFactorRemovalDueAt: '2026-10-03T19:00:00.000Z'
    });
  });

  it('shows no pending removal as null (PLAN 011 phase 4)', async () => {
    findAll.mockResolvedValue({ rows: [{ ...ROW, twoFactorEnabled: false, twoFactorRemovalDueAt: null }], total: 1 });

    const { rows } = await UserController.accounts();

    expect(rows[0]).toMatchObject({ twoFactorEnabled: false, twoFactorRemovalDueAt: null });
  });

  it('keeps an account nobody has seen yet as null, not as a date', async () => {
    findAll.mockResolvedValue({ rows: [{ ...ROW, activatedAt: null, lastActiveAt: null, onboardedAt: null, plans: 0 }], total: 1 });

    const { rows } = await UserController.accounts();

    expect(rows[0]).toMatchObject({ activated: false, lastActiveAt: null, onboardedAt: null, plans: 0 });
  });

  it('carries only its thirteen keys, whatever else a row brings', async () => {
    findAll.mockResolvedValue({ rows: [{ ...ROW, allergies: ['gluten'], weightKg: 80 } as AccountRow], total: 1 });

    const { rows } = await UserController.accounts();

    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'activated',
      'createdAt',
      'email',
      'emailVerified',
      'id',
      'lastActiveAt',
      'onboardedAt',
      'plans',
      'professional',
      'role',
      'tier',
      'twoFactorEnabled',
      'twoFactorRemovalDueAt'
    ]);
  });
});

/*
 * `activate` and `setTier` (`0071`): the admin trail names who did it and
 * how, in the same transaction as the account's own change — built here and
 * handed to the repository, never written from a request body.
 */
describe('UserController.activate', () => {
  beforeEach(() => {
    activate.mockReset();
    record.mockReset();
  });

  it('records the console as the actor, with the console’s via and the id RETURNING found', async () => {
    activate.mockImplementation(async (_match, r) => {
      await r?.(undefined, 'usr-1');

      return { email: 'a@example.com' };
    });

    const result = await UserController.activate({ email: 'a@example.com' }, { actorId: 'usr-owner', via: 'console' });

    expect(result).toEqual({ email: 'a@example.com' });
    expect(record).toHaveBeenCalledWith(
      { action: 'account.activated', actorId: 'usr-owner', entity: 'user', metadata: { via: 'console' }, subjectUserId: 'usr-1' },
      undefined
    );
  });

  it('records a null actor for the mail link and the automatic activation', async () => {
    activate.mockImplementation(async (_match, r) => {
      await r?.(undefined, 'usr-1');

      return { email: 'a@example.com' };
    });

    await UserController.activate({ id: 'usr-1' }, { actorId: null, via: 'mail_link' });

    expect(record).toHaveBeenCalledWith(
      { action: 'account.activated', actorId: null, entity: 'user', metadata: { via: 'mail_link' }, subjectUserId: 'usr-1' },
      undefined
    );
  });

  it('writes nothing when the suites activate an account with UNAUDITED', async () => {
    activate.mockResolvedValue({ email: 'a@example.com' });

    await UserController.activate({ email: 'a@example.com' }, UNAUDITED);

    expect(activate).toHaveBeenCalledWith({ email: 'a@example.com' }, undefined);
    expect(record).not.toHaveBeenCalled();
  });
});

/*
 * PLAN 011, "Follow-up — the 30-day sweep of unconfirmed accounts": the daily cron's own
 * call, with no actor — the cutoff is this controller's own clock, not the caller's.
 */
describe('UserController.sweepUnconfirmedAccounts', () => {
  beforeEach(() => {
    deleteStaleUnconfirmed.mockReset();
    record.mockReset();
  });

  it('asks the repository for thirty days before now, and answers the ids it deleted', async () => {
    deleteStaleUnconfirmed.mockResolvedValue(['usr-1', 'usr-2']);

    const result = await UserController.sweepUnconfirmedAccounts(new Date('2026-10-09T10:00:00.000Z'));

    expect(result).toEqual(['usr-1', 'usr-2']);
    expect(deleteStaleUnconfirmed).toHaveBeenCalledWith(new Date('2026-09-09T10:00:00.000Z'), expect.anything());
  });

  it('defaults the clock to now, the way the audit trail’s own retention does', async () => {
    deleteStaleUnconfirmed.mockResolvedValue([]);

    await UserController.sweepUnconfirmedAccounts();

    expect(deleteStaleUnconfirmed).toHaveBeenCalledTimes(1);
  });

  it('records a null actor, naming the account, for each id the repository deleted', async () => {
    deleteStaleUnconfirmed.mockImplementation(async (_cutoff, r) => {
      await r(undefined, 'usr-1');
      await r(undefined, 'usr-2');

      return ['usr-1', 'usr-2'];
    });

    await UserController.sweepUnconfirmedAccounts(new Date('2026-10-09T10:00:00.000Z'));

    expect(record).toHaveBeenNthCalledWith(
      1,
      { action: 'auth.unconfirmed_account_swept', actorId: null, entity: 'user', metadata: {}, subjectUserId: 'usr-1' },
      undefined
    );
    expect(record).toHaveBeenNthCalledWith(
      2,
      { action: 'auth.unconfirmed_account_swept', actorId: null, entity: 'user', metadata: {}, subjectUserId: 'usr-2' },
      undefined
    );
  });
});

describe('UserController.setTier', () => {
  beforeEach(() => {
    setTier.mockReset();
    record.mockReset();
  });

  it('records the move with the tier it came from', async () => {
    setTier.mockImplementation(async (_id, _tier, r) => {
      await r?.(undefined, 'free');

      return { email: 'a@example.com' };
    });

    const result = await UserController.setTier('usr-1', 'premium', 'usr-owner');

    expect(result).toEqual({ email: 'a@example.com' });
    expect(record).toHaveBeenCalledWith(
      { action: 'account.tier_changed', actorId: 'usr-owner', entity: 'user', metadata: { from: 'free', to: 'premium' }, subjectUserId: 'usr-1' },
      undefined
    );
  });

  it('moves the tier with no audit when the caller gives UNAUDITED', async () => {
    setTier.mockResolvedValue({ email: 'a@example.com' });

    await UserController.setTier('usr-1', 'premium', UNAUDITED);

    expect(setTier).toHaveBeenCalledWith('usr-1', 'premium', undefined);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('UserController.forgetExpiredVerifications', () => {
  it('deletes every verification row past its date, as of the moment given, and says how many', async () => {
    const now = new Date('2026-10-01T08:05:00.000Z');

    forgetExpiredVerifications.mockResolvedValue(4);

    await expect(UserController.forgetExpiredVerifications(now)).resolves.toBe(4);
    expect(forgetExpiredVerifications).toHaveBeenCalledExactlyOnceWith(now);
  });
});

/*
 * PLAN 011 phase 6: what `ProfessionalGuard` and `AdminGuard` ask on every
 * request they see. The flag rides the session, so the common case — the
 * factor on — costs no query.
 */
describe('UserController.needsSecondFactor', () => {
  beforeEach(() => {
    hasPassword.mockReset();
  });

  it('answers false with the factor on, without asking about a password', async () => {
    await expect(UserController.needsSecondFactor({ id: 'usr-1', twoFactorEnabled: true })).resolves.toBe(false);
    expect(hasPassword).not.toHaveBeenCalled();
  });

  it('answers true for a password account with the factor off, asked of the session’s own id', async () => {
    hasPassword.mockResolvedValue(true);

    await expect(UserController.needsSecondFactor({ id: 'usr-1', twoFactorEnabled: false })).resolves.toBe(true);
    expect(hasPassword).toHaveBeenCalledWith('usr-1');
  });

  it('answers false for an account with no password: its second factor is its provider’s', async () => {
    hasPassword.mockResolvedValue(false);

    await expect(UserController.needsSecondFactor({ id: 'usr-1', twoFactorEnabled: false })).resolves.toBe(false);
  });
});
