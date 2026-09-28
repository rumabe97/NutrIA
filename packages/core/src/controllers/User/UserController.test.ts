import { beforeEach, describe, expect, it, vi } from 'vitest';

import { accountQuerySchema } from 'core/entities/AdminQuery';
import { makeUser } from '#test/fixtures';

import { UserController } from './UserController';

import type { AccountQuery } from 'core/entities/AdminQuery';
import type { AccountRow } from '#repositories/User';
import type { User } from 'core/entities/User';

const findById = vi.fn<(id: string) => Promise<User | undefined>>();
const findAll = vi.fn<(query: AccountQuery) => Promise<{ rows: readonly AccountRow[]; total: number }>>();

vi.mock('#repositories/User', () => ({
  UserRepository: { findAll: (query: AccountQuery) => findAll(query), findById: (id: string) => findById(id) }
}));

/*
 * The account view is what every gate in the web app reads. It carried only
 * `emailVerified`, so the app shell asked about the address and let a
 * confirmed-but-unopened account in (`0030`). These two cases are that bug.
 */
describe('UserController.getUser — activation is not the address', () => {
  beforeEach(() => {
    findById.mockReset();
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
  tier: 'free'
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
      tier: 'free'
    });
  });

  it('keeps an account nobody has seen yet as null, not as a date', async () => {
    findAll.mockResolvedValue({ rows: [{ ...ROW, activatedAt: null, lastActiveAt: null, onboardedAt: null, plans: 0 }], total: 1 });

    const { rows } = await UserController.accounts();

    expect(rows[0]).toMatchObject({ activated: false, lastActiveAt: null, onboardedAt: null, plans: 0 });
  });

  it('carries only its eleven keys, whatever else a row brings', async () => {
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
      'tier'
    ]);
  });
});
