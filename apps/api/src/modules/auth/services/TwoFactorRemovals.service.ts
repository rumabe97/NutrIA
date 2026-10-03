import { Inject, Injectable, Logger } from '@nestjs/common';

import { TwoFactorController } from 'core/controllers/TwoFactor';

import { EmailService } from '../../email/services/Email.service.js';
import { ENV } from '../../../config/index.js';
import { sendTwoFactorRemovalMail } from './TwoFactorRemovalMail.js';

import type { Env } from '../../../config/index.js';

/** What one run removed, and how many due removals failed and are left for tomorrow. */
export type TwoFactorRemovalRun = { readonly failed: number; readonly removed: number };

/**
 * The daily step that carries out the owner's removals of lost second factors
 * (PLAN 011 phase 4), called by `/cron/two-factor-removals`. For every request
 * whose 48 hours have passed and that nobody cancelled, `core` removes the
 * factor — re-checking, inside the removal's own transaction, that it is
 * still due and still pending — and the account's address is told.
 *
 * Idempotent: a second run finds no row. One account that fails is a line
 * and a count, and tomorrow's run tries it again; listing the due requests
 * failing throws, so the cron run shows as failed. The log carries the
 * account id at most: never the address, the secret or a code.
 */
@Injectable()
export class TwoFactorRemovalsService {
  private readonly logger = new Logger(TwoFactorRemovalsService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly email: EmailService
  ) {}

  async run(now: Date = new Date()): Promise<TwoFactorRemovalRun> {
    const due = await TwoFactorController.dueRemovals(now);
    let removed = 0;
    let failed = 0;

    for (const userId of due) {
      try {
        const done = await TwoFactorController.removeDue(userId, now);

        if (!done) {
          continue;
        }

        removed += 1;
        // Awaited, one at a time: a cron has nobody waiting on it, and a mail that fails is a line, not a failed removal.
        await sendTwoFactorRemovalMail(this.email, { appUrl: this.env.APP_URL, event: { kind: 'removed' }, to: done.email, userId }).catch(() => {
          this.logger.warn(`two_factor_removed_unmailed ${JSON.stringify({ userId })}`);
        });
      } catch {
        failed += 1;
        this.logger.error(`two_factor_removal_failed ${JSON.stringify({ userId })}`);
      }
    }

    this.logger.log(`Two-factor removals: ${removed} removed, ${failed} failed`);

    return { failed, removed };
  }
}
