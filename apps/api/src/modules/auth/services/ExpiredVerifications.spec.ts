import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { UserController } from 'core/controllers/User';

import { ExpiredVerificationsService } from './ExpiredVerifications.service.js';

describe('ExpiredVerificationsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks core to delete every expired verification row and answers how many went', async () => {
    const forget = jest.spyOn(UserController, 'forgetExpiredVerifications').mockResolvedValue(3);

    await expect(new ExpiredVerificationsService().forget()).resolves.toBe(3);
    expect(forget).toHaveBeenCalledTimes(1);
  });

  it('lets a failure through, so the cron run is seen to fail', async () => {
    jest.spyOn(UserController, 'forgetExpiredVerifications').mockRejectedValue(new Error('database down'));

    await expect(new ExpiredVerificationsService().forget()).rejects.toThrow('database down');
  });
});
