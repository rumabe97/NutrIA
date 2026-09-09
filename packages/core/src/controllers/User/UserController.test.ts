import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeUser } from '#test/fixtures';

import { UserController } from './UserController';

import type { User } from 'core/entities/User';

const findById = vi.fn<(id: string) => Promise<User | undefined>>();

vi.mock('#repositories/User', () => ({
  UserRepository: { findById: (id: string) => findById(id) }
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
