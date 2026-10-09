import { Injectable, Logger } from '@nestjs/common';

import { AuditController } from 'core/controllers/Audit';
import { SignInBrakeController } from 'core/controllers/SignInBrake';
import { UserController } from 'core/controllers/User';

/** What one run of the retention deleted. */
export type AuthRetentionRun = { readonly authAuditRows: number; readonly signInFailures: number; readonly unconfirmedAccounts: number };

/**
 * What the authentication keeps, kept no longer (PLAN 011 phase 7), run by
 * `/cron/sweep-verifications` after the verification prune:
 *
 * - the sign-in brake's rows a day quiet, which by then brake nothing;
 * - the `auth.*` rows of the audit trail older than twelve months (`legal`'s
 *   retention, `docs/legal/analisis.md` § 4.1 bis), and no other action's;
 * - an account whose address nobody ever confirmed, thirty days on, holding
 *   no session, profile, plan or audit row — the "30-day sweep" follow-up,
 *   `legal` P2-15: anybody can sign a password up against any address, and
 *   nothing before this deleted the ones nobody ever claimed.
 *
 * No AI, no mail, no switch.
 */
@Injectable()
export class AuthRetentionService {
  private readonly logger = new Logger(AuthRetentionService.name);

  /** Throws on failure, so the cron run shows as failed; tomorrow's run deletes what today's did not. */
  async forget(): Promise<AuthRetentionRun> {
    const signInFailures = await SignInBrakeController.forgetQuiet();
    const authAuditRows = await AuditController.forgetExpiredAuthRows();
    const unconfirmedAccounts = (await UserController.sweepUnconfirmedAccounts()).length;

    this.logger.log(
      `Quiet sign-in brake rows deleted: ${signInFailures}; auth audit rows past retention deleted: ${authAuditRows}; unconfirmed accounts swept: ${unconfirmedAccounts}`
    );

    return { authAuditRows, signInFailures, unconfirmedAccounts };
  }
}
