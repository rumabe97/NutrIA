import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { APIError } from 'better-auth/api';

import { ProfessionalController } from 'core/controllers/Professional';
import { UserController } from 'core/controllers/User';
import { ReauthenticationRequiredError } from 'core/entities/Error';

import { UsersService } from './Users.service.js';

import type { Auth } from '../../auth/auth.config.js';
import type { StoredUserView } from 'core/controllers/User';

const ACCOUNT: StoredUserView = {
  id: 'usr-1',
  activated: true,
  createdAt: '2026-09-01T10:00:00.000Z',
  email: 'persona@example.com',
  emailVerified: true,
  image: null,
  name: 'Persona',
  role: 'user',
  tier: 'free'
};

/*
 * `professional` on `/users/me` is what the menu reads to show the way into the
 * workspace. It must be the guard's own answer — `hasAccess`, switch and grant —
 * for the session's account, asked again on every request, and present as
 * `false` for everybody else so its absence says nothing.
 */
describe('UsersService.me — professional', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function harness() {
    jest.spyOn(UserController, 'getUser').mockResolvedValue(ACCOUNT);

    return new UsersService({} as Auth);
  }

  // That the switch wins over a standing grant is `hasAccess`'s own test in core, where the grant can be mocked.
  it('is false while the switch is off, without asking about a grant', async () => {
    const service = harness();
    jest.spyOn(ProfessionalController, 'isOpen').mockResolvedValue(false);

    await expect(service.me('usr-1')).resolves.toEqual({ ...ACCOUNT, professional: false });
  });

  it('is true for a granted account with the switch on — the guard’s question, for the session’s account', async () => {
    const service = harness();
    const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(true);

    await expect(service.me('usr-1')).resolves.toEqual({ ...ACCOUNT, professional: true });
    expect(hasAccess).toHaveBeenCalledWith('usr-1');
  });

  it('is false on the next request once the grant is revoked — never cached', async () => {
    const service = harness();
    const hasAccess = jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(service.me('usr-1')).resolves.toMatchObject({ professional: true });
    await expect(service.me('usr-1')).resolves.toMatchObject({ professional: false });
    expect(hasAccess).toHaveBeenCalledTimes(2);
  });

  it('is present and false for an ordinary account', async () => {
    const service = harness();
    jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(false);

    const me = await service.me('usr-1');

    expect(me).toHaveProperty('professional', false);
  });

  it('is false, and the account still answers, when the question cannot be asked', async () => {
    const service = harness();
    jest.spyOn(ProfessionalController, 'hasAccess').mockRejectedValue(new Error('settings unreachable'));

    await expect(service.me('usr-1')).resolves.toEqual({ ...ACCOUNT, professional: false });
  });
});

/*
 * Production, 2026-09-30: a Google account deleting itself from a session older
 * than a day got a 500. Better Auth refuses that delete on purpose — no password,
 * a stale session — and the refusal must reach the person as something to do,
 * not as a failure. The rule itself is not relaxed.
 */
describe('UsersService.remove', () => {
  function harness(deleteUser: (input: { body: object; headers: Headers }) => Promise<unknown>) {
    const spy = jest.fn(deleteUser);

    return { deleteUser: spy, service: new UsersService({ api: { deleteUser: spy } } as unknown as Auth) };
  }

  it('asks Better Auth to delete the session’s own account, with no password and nothing else in the body', async () => {
    const { deleteUser, service } = harness(async () => ({ message: 'User deleted', success: true }));

    await service.remove({ cookie: 'better-auth.session_token=abc' });

    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser.mock.calls[0]?.[0].body).toEqual({});
    expect(deleteUser.mock.calls[0]?.[0].headers.get('cookie')).toBe('better-auth.session_token=abc');
  });

  it('turns a session too old to delete with into ReauthenticationRequiredError', async () => {
    const { service } = harness(() =>
      Promise.reject(APIError.from('BAD_REQUEST', { code: 'SESSION_EXPIRED', message: 'Session expired. Re-authenticate to perform this action.' }))
    );

    await expect(service.remove({})).rejects.toBeInstanceOf(ReauthenticationRequiredError);
  });

  it('lets any other Better Auth refusal through untouched, for the filter to translate', async () => {
    const refusal = APIError.from('BAD_REQUEST', { code: 'INVALID_PASSWORD', message: 'Invalid password' });
    const { service } = harness(() => Promise.reject(refusal));

    await expect(service.remove({})).rejects.toBe(refusal);
  });

  it('lets a failure that is not Better Auth’s through untouched — Stripe unreachable stays a 500 and the account stays', async () => {
    const failure = new Error('Stripe could not be reached');
    const { service } = harness(() => Promise.reject(failure));

    await expect(service.remove({})).rejects.toBe(failure);
  });
});
