import { Inject, Injectable, Logger } from '@nestjs/common';

import { AdminAlertController, hasNews } from 'core/controllers/Admin';
import { DEFAULT_WEB_LOCALE, webUrl } from 'core/domain/WebUrl';
import { madridDayKey, madridMidnight } from 'core/domain/Period';
import { monthStart } from 'core/controllers/Recipe';

import { ENV } from '../../../config/index.js';
import { EmailService } from '../../email/services/Email.service.js';
import { ownerAlertEmail } from '../../email/templates/OwnerAlert.js';
import { ownerDigestEmail } from '../../email/templates/OwnerDigest.js';
import { STEPS_VERSION } from '../../ai/prompts/PoolPrompt.js';

import type { Env } from '../../../config/index.js';
import type { OwnerAlertCaps, SpendCrossing } from 'core/controllers/Admin';
import type { OwnerAlert } from '../../email/templates/OwnerAlert.js';
import type { RenderedEmail } from '../../email/templates/Layout.js';

/** An alert of one kind is not repeated within this many hours (`0071`). */
const REPEAT_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Tells the owner by mail, unasked (`0071`).
 *
 * - **The digest**: at most one a day (`owner_alerted { kind: 'digest' }` per
 *   Madrid day), and only when something in it is non-zero.
 * - **Three generations in a row failed**: checked where a job fails.
 * - **Spend at 80 % or 100 % of a cap**: once per threshold and UTC month,
 *   checked when a job ends, when the nightly rewrite ends and in the digest.
 *   A per-call check would put a query on the path of every model call; a
 *   plan job makes several and ends minutes later, which is early enough for a
 *   number that moves over days.
 *
 * Every mail carries numbers, codes from closed lists and links, never an
 * address or anybody's text (`OwnerDigest`, `OwnerAlert`). The right to send is
 * *claimed* first, atomically (`claimOwnerAlert`), so two jobs that fail
 * together send one mail; a claim whose mail did not leave is given back.
 *
 * **Never throws and never waits on the mail's answer for anything else**: an
 * owner's inbox that is unreachable must not cost a person their plan. Silent
 * without `OWNER_EMAIL` or without SMTP, like `notifyOwnerOfWaitingAccount`.
 */
@Injectable()
export class OwnerAlertsService {
  private readonly logger = new Logger(OwnerAlertsService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mailer: EmailService
  ) {}

  private get owner(): string | undefined {
    return this.mailer.configured ? this.env.OWNER_EMAIL : undefined;
  }

  private get caps(): OwnerAlertCaps {
    return { pictureCapUsd: this.env.AI_IMAGE_MONTHLY_CAP_USD, textCapUsd: this.env.AI_TEXT_MONTHLY_CAP_USD };
  }

  private link = (path: string): string => webUrl(this.env.APP_URL, path, DEFAULT_WEB_LOCALE);

  /** The morning digest. Called first by the reminders cron, before its switch is looked at. */
  async digest(now = new Date()): Promise<void> {
    if (this.owner === undefined) {
      return;
    }

    // Even on a day the digest stays silent: pictures spend when meal pages are opened, not when a job ends.
    await this.checkSpend(now);

    try {
      const digest = await AdminAlertController.digest(now, { ...this.caps, stepsVersion: STEPS_VERSION });

      if (!hasNews(digest)) {
        return;
      }

      await this.deliver('digest', madridMidnight(madridDayKey(now)), ownerDigestEmail({ digest, link: this.link }));
    } catch (error: unknown) {
      this.logger.error(`The owner's digest failed: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    }
  }

  /**
   * After a generation ends: the streak, when it failed, and the spend, either way.
   * Awaiting it is safe, and skipping the await is too.
   */
  async afterJob(failed: boolean, now = new Date()): Promise<void> {
    if (this.owner === undefined) {
      return;
    }

    if (failed) {
      await this.failureStreak(now);
    }

    await this.checkSpend(now);
  }

  /** Text or pictures at 80 % or 100 % of their cap, once per threshold and month. */
  async checkSpend(now = new Date()): Promise<void> {
    if (this.owner === undefined) {
      return;
    }

    try {
      for (const crossing of await AdminAlertController.spendCrossings(now, this.caps)) {
        await this.spendAlert(crossing, now);
      }
    } catch (error: unknown) {
      this.logger.error(`The spend check failed: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    }
  }

  private async failureStreak(now: Date): Promise<void> {
    try {
      const codes = await AdminAlertController.failureStreak();

      if (codes !== null) {
        await this.deliver('generation-streak', new Date(now.getTime() - REPEAT_HOURS * HOUR_MS), this.alert({ codes, type: 'failures' }));
      }
    } catch (error: unknown) {
      this.logger.error(`The failure streak check failed: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    }
  }

  private async spendAlert(crossing: SpendCrossing, now: Date): Promise<void> {
    const since = monthStart(now);

    // A jump straight past 100 % is one mail, not two: the lower threshold is taken without a word.
    if (crossing.threshold === 100) {
      await AdminAlertController.claim(`spend-${crossing.source}-80`, since);
    }

    await this.deliver(`spend-${crossing.source}-${String(crossing.threshold)}`, since, this.alert({ ...crossing, type: 'spend' }));
  }

  private alert(alert: OwnerAlert): RenderedEmail {
    return ownerAlertEmail({ alert, link: this.link });
  }

  /** Claims `kind` since `since`, sends, and gives the claim back when the mail did not leave. */
  private async deliver(kind: string, since: Date, mail: RenderedEmail): Promise<void> {
    const to = this.owner;

    if (to === undefined) {
      return;
    }

    const claim = await AdminAlertController.claim(kind, since);

    if (claim === null) {
      return;
    }

    const sent = await this.mailer.send({ ...mail, to });

    if (!sent) {
      await AdminAlertController.release(claim);
    }

    this.logger.log(`owner ${sent ? 'told' : 'NOT told'}: ${kind}`);
  }
}
