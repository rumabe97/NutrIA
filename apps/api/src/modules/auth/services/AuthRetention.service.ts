import { Injectable, Logger } from '@nestjs/common';

import { AuditController } from 'core/controllers/Audit';
import { SignInBrakeController } from 'core/controllers/SignInBrake';

/** What one run of the retention deleted. */
export type AuthRetentionRun = { readonly authAuditRows: number; readonly signInFailures: number };

/**
 * What the authentication keeps, kept no longer (PLAN 011 phase 7), run by
 * `/cron/sweep-verifications` after the verification prune:
 *
 * - the sign-in brake's rows a day quiet, which by then brake nothing;
 * - the `auth.*` rows of the audit trail older than twelve months (`legal`'s
 *   retention, `docs/legal/analisis.md` § 4.1 bis), and no other action's.
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

    this.logger.log(`Quiet sign-in brake rows deleted: ${signInFailures}; auth audit rows past retention deleted: ${authAuditRows}`);

    return { authAuditRows, signInFailures };
  }
}
