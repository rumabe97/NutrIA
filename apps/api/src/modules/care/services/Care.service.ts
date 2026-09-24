import { Inject, Injectable, Logger } from '@nestjs/common';

import { CareController } from 'core/controllers/Care';
import { webUrl } from 'core/domain/WebUrl';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { careInvitationEmail } from '../../email/templates/CareInvitation.js';
import { EmailService, recipientLocale } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';

import type { AcceptInvitationDto, InviteClientDto } from '../dto/in/index.js';
import type {
  CareAccessPageDto,
  CareClientOverviewDto,
  CareClientsDto,
  CareInvitationDetailDto,
  CareInvitationDto,
  CareLinkDto
} from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The link between a professional and a client (`0059`). Every rule is in
 * `CareController`; this is the seam, and the one place a mail is queued.
 */
@Injectable()
export class CareService {
  private readonly logger = new Logger(CareService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly background: BackgroundTaskService,
    private readonly email: EmailService
  ) {}

  async accept(user: SessionUser, token: string, body: AcceptInvitationDto): Promise<CareLinkDto> {
    return CareController.accept(user, token, body);
  }

  async accessLog(user: SessionUser, before: string | null): Promise<CareAccessPageDto> {
    return CareController.accessLog(user, before);
  }

  async clients(professional: SessionUser): Promise<CareClientsDto> {
    return CareController.clients(professional);
  }

  async decline(user: SessionUser, token: string): Promise<void> {
    await CareController.decline(user, token);
  }

  async end(user: SessionUser, linkId: string): Promise<void> {
    await CareController.end(user, linkId);
  }

  async invitation(user: SessionUser, token: string): Promise<CareInvitationDetailDto> {
    return CareController.invitation(user, token);
  }

  /**
   * Stores the invitation, then answers — the mail goes out afterwards, in the
   * background, so the answer and its timing cannot depend on anything about
   * the invited address. The token leaves this method only inside that mail.
   */
  async invite(professional: SessionUser, body: InviteClientDto): Promise<CareInvitationDto> {
    const { invitation, token } = await CareController.invite(professional, body);

    this.background.run('care-invitation-mail', async () => this.mail(professional, invitation.email, token));

    return invitation;
  }

  async myLink(user: SessionUser): Promise<CareLinkDto | null> {
    return CareController.myLink(user);
  }

  /** Through `CareController.withClient`, inside the core call: the client's id never reaches this app. */
  async overview(professional: SessionUser, linkId: string, locale: string | null): Promise<CareClientOverviewDto> {
    return CareController.overview(professional, linkId, locale);
  }

  /**
   * In the inviter's language: the recipient may have no account, so theirs is
   * unknown. Never logs the address or the token — a failure says only that
   * an invitation mail did not go.
   */
  private async mail(professional: SessionUser, to: string, token: string): Promise<void> {
    const locale = await recipientLocale(professional.id);
    const url = webUrl(this.env.APP_URL, `/invitacion/${token}`, locale);
    const sent = await this.email.send({ ...careInvitationEmail({ inviterName: professional.name, locale, url }), to });

    if (!sent) {
      this.logger.warn('care invitation mail not sent');
    }
  }
}
