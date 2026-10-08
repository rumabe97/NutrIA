import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { UserController } from 'core/controllers/User';

import { resetConfirmsAddress } from './ResetConfirmsAddress.js';

import type { Context } from './PasswordPolicy.js';

const ACCOUNT = { id: 'user-1', email: 'alguien@example.invalid' };

describe('resetConfirmsAddress', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('confirms nothing for a reset with no request: there is no after-hook, and the sessions are still alive', async () => {
    const confirmed = jest.spyOn(UserController, 'confirmAddressByReset').mockResolvedValue(true);
    const addressConfirmed = jest.fn(async (_account: typeof ACCOUNT) => Promise.resolve());

    await resetConfirmsAddress({ addressConfirmed }).remember(ACCOUNT, undefined);

    expect(confirmed).not.toHaveBeenCalled();
    expect(addressConfirmed).not.toHaveBeenCalled();
  });

  it('confirms in the after-hook of the request that reset, once', async () => {
    const confirmed = jest.spyOn(UserController, 'confirmAddressByReset').mockResolvedValue(true);
    const addressConfirmed = jest.fn(async (_account: typeof ACCOUNT) => Promise.resolve());
    const confirmation = resetConfirmsAddress({ addressConfirmed });
    const request = new Request('http://localhost:3001/api/auth/reset-password', { method: 'POST' });

    await confirmation.remember(ACCOUNT, request);

    expect(confirmed).not.toHaveBeenCalled();

    await confirmation.after({ path: '/reset-password', request } as unknown as Context);
    await confirmation.after({ path: '/reset-password', request } as unknown as Context);

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(addressConfirmed).toHaveBeenCalledWith(ACCOUNT);
  });
});
