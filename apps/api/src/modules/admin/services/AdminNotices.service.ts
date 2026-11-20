import { Inject, Injectable, Logger } from '@nestjs/common';

import { NoticeController } from 'core/controllers/Notice';
import { madridMidnight } from 'core/domain/Period';
import { webUrl } from 'core/domain/WebUrl';

import { EmailService, recipientLocale } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';
import { termsChangeNoticeEmail } from '../../email/templates/TermsChangeNotice.js';

import type { DeliverNotice } from 'core/controllers/Notice';
import type { Env } from '../../../config/index.js';
import type { NoticeDateDto } from '../dto/in/index.js';
import type { NoticePreviewDto, NoticeSendDto } from '../dto/out/index.js';

/**
 * The owner's notice to every account (project 025 phase 10, `textos/06` § Z):
 * the API's half — the template, the links in each reader's language, and the
 * mail server. Who is owed it, in what order, what is recorded and when, the
 * day's rules and the audit row are `NoticeController`'s.
 */
@Injectable()
export class AdminNoticesService {
  private readonly logger = new Logger(AdminNoticesService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly email: EmailService
  ) {}

  async preview(notice: string, body: NoticeDateDto): Promise<NoticePreviewDto> {
    return NoticeController.preview(notice, body, userId => recipientLocale(userId));
  }

  async send(notice: string, ownerId: string, body: NoticeDateDto): Promise<NoticeSendDto> {
    const sent = await NoticeController.send(notice, ownerId, body, this.deliver(body.date));

    // Counts only: never an address.
    this.logger.log(`notice ${notice}: ${String(sent.sent)} sent, ${String(sent.failed)} failed, ${String(sent.remaining)} remaining`);

    return sent;
  }

  /**
   * One account's mail, in its own language: the policy's «Tu profesional en
   * NutrIA» and the terms on that language's pages, and the address the
   * service answers at — `EMAIL_FROM`, the one every mail leaves from and every
   * reply reaches.
   */
  private deliver(date: string): DeliverNotice {
    return async account => {
      const locale = await recipientLocale(account.id);
      const mail = termsChangeNoticeEmail({
        effectiveOn: madridMidnight(date),
        email: this.env.EMAIL_FROM ?? '',
        locale,
        privacyUrl: webUrl(this.env.APP_URL, '/privacidad#tu-profesional', locale),
        termsUrl: webUrl(this.env.APP_URL, '/condiciones', locale)
      });

      return { accepted: await this.email.send({ ...mail, to: account.email }), locale };
    };
  }
}
