import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { NotFoundError } from 'core/entities/Error';
import { TwoFactorController } from 'core/controllers/TwoFactor';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';
import { sendTwoFactorRemovalMail } from '../../auth/services/TwoFactorRemovalMail.js';

import type { Env } from '../../../config/index.js';
import type { TwoFactorRemovalDto } from '../dto/out/index.js';
import type { TwoFactorRemovalEvent } from '../../email/templates/TwoFactorRemoval.js';

/**
 * A `NotFoundError` answered byte for byte as the guard's 404 — its message names the id, and the owner typing
 * one that does not exist learns what a stranger would. Anything else goes on to the filter as it was.
 */
function asGuardNotFound(error: unknown): never {
  throw error instanceof NotFoundError ? new NotFoundException() : error;
}

/**
 * The owner's removal of a lost second factor (PLAN 011 phase 4): the request
 * and its cancel from the console. The rules and the audit rows are
 * `core/controllers/TwoFactor`'s; this sends the account its mail, in the
 * background, so the owner's answer never waits on a mailbox — and never
 * carries the address.
 */
@Injectable()
export class AdminTwoFactorService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly background: BackgroundTaskService,
    private readonly email: EmailService
  ) {}

  /** Cancels a pending removal; nothing pending, or no such account, is the guard's own 404. */
  async cancel(userId: string, actorId: string): Promise<void> {
    const { email } = await TwoFactorController.cancelRemovalByOwner(userId, actorId).catch(asGuardNotFound);

    this.mail(userId, email, { kind: 'cancelled' });
  }

  /** Asks for the removal 48 hours from now and tells the account's own address at once. An unknown account is the guard's own 404. */
  async request(userId: string, actorId: string): Promise<TwoFactorRemovalDto> {
    const { dueAt, email } = await TwoFactorController.requestRemoval(userId, actorId).catch(asGuardNotFound);

    this.mail(userId, email, { dueAt: new Date(dueAt), kind: 'requested' });

    return { dueAt };
  }

  private mail(userId: string, to: string, event: TwoFactorRemovalEvent): void {
    this.background.run('two-factor-removal-mail', async () => sendTwoFactorRemovalMail(this.email, { appUrl: this.env.APP_URL, event, to, userId }));
  }
}
