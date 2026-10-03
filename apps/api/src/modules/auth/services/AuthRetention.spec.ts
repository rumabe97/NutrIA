import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { AuditController } from 'core/controllers/Audit';
import { SignInBrakeController } from 'core/controllers/SignInBrake';

import { AuthRetentionService } from './AuthRetention.service.js';

describe('AuthRetentionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forgets the quiet brake rows and the auth audit rows past retention, and answers both counts', async () => {
    const quiet = jest.spyOn(SignInBrakeController, 'forgetQuiet').mockResolvedValue(2);
    const audit = jest.spyOn(AuditController, 'forgetExpiredAuthRows').mockResolvedValue(7);

    await expect(new AuthRetentionService().forget()).resolves.toEqual({ authAuditRows: 7, signInFailures: 2 });
    expect(quiet).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('lets a failure through, so the cron run is seen to fail', async () => {
    jest.spyOn(SignInBrakeController, 'forgetQuiet').mockRejectedValue(new Error('database down'));

    await expect(new AuthRetentionService().forget()).rejects.toThrow('database down');
  });
});
