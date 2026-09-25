import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { CareController } from 'core/controllers/Care';

import { ExpiredInvitationsService } from './ExpiredInvitations.service.js';

describe('ExpiredInvitationsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks core to delete every expired invitation', async () => {
    const forget = jest.spyOn(CareController, 'forgetExpiredInvitations').mockResolvedValue(2);

    await new ExpiredInvitationsService().forget();

    expect(forget).toHaveBeenCalledTimes(1);
  });

  it('never throws, so the reminders beside it still run', async () => {
    jest.spyOn(CareController, 'forgetExpiredInvitations').mockRejectedValue(new Error('database down'));

    await expect(new ExpiredInvitationsService().forget()).resolves.toBeUndefined();
  });
});
