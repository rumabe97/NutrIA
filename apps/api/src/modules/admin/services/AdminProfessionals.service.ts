import { Inject, Injectable, Logger } from '@nestjs/common';

import { ProfessionalController } from 'core/controllers/Professional';
import { webUrl } from 'core/domain/WebUrl';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService, recipientLocale } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';
import { professionalGrantedEmail } from '../../email/templates/ProfessionalGranted.js';

import type { Env } from '../../../config/index.js';
import type { GrantProfessionalDto } from '../dto/in/index.js';
import type { ProfessionalAccountDto, ProfessionalsDto } from '../dto/out/index.js';

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
      this.background.run('professional-granted-mail', async () => this.mail(account.userId, account.email, account.collegiateNumber));
    }

    return account;
  }

  async list(): Promise<ProfessionalsDto> {
    return ProfessionalController.list();
  }

  async revoke(id: string): Promise<void> {
    await ProfessionalController.revoke(id);
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
