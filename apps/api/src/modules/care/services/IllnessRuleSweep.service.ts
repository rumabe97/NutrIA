import { Inject, Injectable, Logger } from '@nestjs/common';

import { CareController } from 'core/controllers/Care';
import { webUrl } from 'core/domain/WebUrl';

import { careLinkEndedByRuleEmail } from '../../email/templates/CareLinkEndedByRule.js';
import { EmailService, recipientLocale } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';

import type { Env } from '../../../config/index.js';

/**
 * The illness rule's daily part (`0111` § 8, PRD 025 criterion 22, PLAN phase 5
 * step 4), in `/cron/reminders` after the badge's own pass: every open link whose
 * practitioner does not hold NutrIA's badge now, while the client has a condition
 * or a medication on record, ends (`CareController.endUnderBadgeLoss`).
 *
 * Whatever the `professional` switch says: a link to an un-badged practitioner
 * over a declared condition is not to wait for the switch to be read.
 *
 * Each **client** is mailed once (`docs/legal/textos/06` § Y), with no word of
 * health; **nobody else is**: to the practitioner the link reads as one the
 * client ended (legal F4). A mail that fails leaves the ending as it is — the
 * profile explains it the next time the client looks (`GET /care/links/me/ended`).
 *
 * **Never throws**: a broken sweep is logged and must not cost the reminders
 * beside it their run; tomorrow's finds what today's did not end. Logs counts
 * only — never an account, an address, a name, or anything of a record.
 */
@Injectable()
export class IllnessRuleSweepService {
  private readonly logger = new Logger(IllnessRuleSweepService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mailer: EmailService
  ) {}

  async run(now = new Date()): Promise<void> {
    try {
      const ended = await CareController.endUnderBadgeLoss(now);
      let unmailed = 0;

      for (const link of ended) {
        unmailed += (await this.notify(link)) ? 0 : 1;
      }

      if (ended.length > 0) {
        this.logger.log(`illness rule sweep: ended ${ended.length}, not mailed ${unmailed}`);
      }
    } catch (error: unknown) {
      this.logger.error(`The illness rule sweep failed: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    }
  }

  /** The client's mail; false when it could not go. Never throws: the ending stands either way. */
  private async notify(link: { readonly clientId: string; readonly professionalName: string; readonly to: string | null }): Promise<boolean> {
    if (!link.to) {
      return false;
    }

    try {
      const locale = await recipientLocale(link.clientId);
      const url = webUrl(this.env.APP_URL, '/perfil', locale);

      return await this.mailer.send({ ...careLinkEndedByRuleEmail({ locale, professionalName: link.professionalName, url }), to: link.to });
    } catch {
      return false;
    }
  }
}
