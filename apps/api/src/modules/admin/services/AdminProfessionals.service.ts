import { Inject, Injectable, Logger } from '@nestjs/common';

import { ProfessionalBadgeController, ProfessionalController } from 'core/controllers/Professional';
import { webUrl } from 'core/domain/WebUrl';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService, recipientLocale } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';
import { professionalBadgeCodeEmail } from '../../email/templates/ProfessionalBadgeCode.js';
import { professionalBadgeRemovedEmail } from '../../email/templates/ProfessionalBadgeRemoved.js';
import { professionalGrantedEmail } from '../../email/templates/ProfessionalGranted.js';

import type { Env } from '../../../config/index.js';
import type { BadgeRemoval } from 'core/controllers/Professional';
import type { GrantProfessionalDto, IssueBadgeCodeDto, ProfessionalsQueryDto, RemoveBadgeDto } from '../dto/in/index.js';
import type { BadgeCodeIssuedDto, BadgeQueueDto, BadgeRecordDto, ProfessionalAccountDto, ProfessionalsDto } from '../dto/out/index.js';

@Injectable()
export class AdminProfessionalsService {
  private readonly logger = new Logger(AdminProfessionalsService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly background: BackgroundTaskService,
    private readonly email: EmailService
  ) {}

  /**
   * The owner's act (`0059`). `id` names the account being granted; `grantedBy`
   * is the session's user — the owner — and is what the row remembers.
   *
   * A first grant tells the professional (`docs/legal/textos/06` § B), in the
   * background so the owner's answer does not wait on a mailbox; granting again
   * — a corrected number — does not.
   */
  async grant(id: string, body: GrantProfessionalDto, grantedBy: string): Promise<ProfessionalAccountDto> {
    const first = (await ProfessionalController.find(id)) === null;
    const account = await ProfessionalController.grant(id, body, grantedBy);

    if (first) {
      // The number just granted — the `pass` this grant wrote (project 025 phase 3, step 7), so a checked number.
      this.background.run('professional-granted-mail', async () => this.mail(account.userId, account.email, body.collegiateNumber));
    }

    return account;
  }

  async badge(userId: string): Promise<BadgeRecordDto> {
    return ProfessionalBadgeController.record(userId);
  }

  async badges(): Promise<BadgeQueueDto> {
    return ProfessionalBadgeController.queue();
  }

  async confirmBadge(userId: string, ownerId: string): Promise<BadgeRecordDto> {
    return ProfessionalBadgeController.confirm(userId, ownerId);
  }

  /**
   * A code through the channel the register allows (PRD 025 scope 6). By letter
   * or phone the code is answered to the owner, once — the store keeps its hash
   * alone. By e-mail it goes, awaited, to the address the owner read on the
   * register, which is used for that mail and kept nowhere; the answer says
   * whether it left, and never carries the code. A mail that did not leave
   * leaves a live code nobody holds: issuing again replaces it.
   *
   * Spanish: the register is a Spanish college's, and the person it lists may
   * not be the account that applied (finding F2), so the account's language
   * says nothing about theirs.
   */
  async issueBadgeCode(userId: string, body: IssueBadgeCodeDto): Promise<BadgeCodeIssuedDto> {
    const issued = await ProfessionalBadgeController.issueCode(userId, body);
    const expiresAt = issued.expiresAt.toISOString();

    if (body.channel !== 'register_email') {
      return { channel: issued.channel, code: issued.code, expiresAt, mailed: null };
    }

    const locale = 'es-ES';
    const mail = professionalBadgeCodeEmail({
      code: issued.code,
      expires: issued.expiresAt,
      locale,
      number: issued.number,
      privacyUrl: webUrl(this.env.APP_URL, '/privacidad#tu-profesional', locale),
      // The college as the owner read it on the register, never as the applicant typed it (invariant review of phase 3, P2-7).
      register: body.register,
      registerName: body.registerName
    });
    const mailed = await this.email.send({ ...mail, to: body.email });

    if (!mailed) {
      this.logger.warn('badge code mail not sent');
    }

    return { channel: issued.channel, code: null, expiresAt, mailed };
  }

  /**
   * A `fail` or `withdrawn` with its statement of reasons, mailed in the
   * background to the account's own address in its own language (`textos/06`
   * § W). The answer is the record as it now stands.
   */
  async removeBadge(userId: string, body: RemoveBadgeDto, ownerId: string): Promise<BadgeRecordDto> {
    const removal = await ProfessionalBadgeController.remove(userId, ownerId, body);

    this.background.run('badge-removed-mail', async () => this.statement(userId, removal));

    return removal.record;
  }

  async list(query: ProfessionalsQueryDto): Promise<ProfessionalsDto> {
    return ProfessionalController.list(query);
  }

  async revoke(id: string, actorId: string): Promise<void> {
    await ProfessionalController.revoke(id, actorId);
  }

  /** The statement of reasons. Never logs the address, the number or the reason: a failure says only that it did not go. */
  private async statement(userId: string, removal: BadgeRemoval): Promise<void> {
    const locale = await recipientLocale(userId);
    const sent = await this.email.send({
      ...professionalBadgeRemovedEmail({
        checkedOn: removal.checkedAt,
        facts: removal.facts,
        kind: removal.kind,
        locale,
        number: removal.number,
        reason: removal.reason,
        register: removal.register,
        source: removal.source
      }),
      to: removal.to
    });

    if (!sent) {
      this.logger.warn('badge statement of reasons not sent');
    }
  }

  /** In the professional's own language. Never logs the address or the number: a failure says only that the mail did not go. */
  private async mail(userId: string, to: string, collegiateNumber: string): Promise<void> {
    const locale = await recipientLocale(userId);
    const url = webUrl(this.env.APP_URL, '/consulta', locale);
    const sent = await this.email.send({ ...professionalGrantedEmail({ collegiateNumber, locale, url }), to });

    if (!sent) {
      this.logger.warn('professional granted mail not sent');
    }
  }
}
