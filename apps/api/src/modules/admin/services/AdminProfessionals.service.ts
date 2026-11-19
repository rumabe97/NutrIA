import { Inject, Injectable, Logger } from '@nestjs/common';

import { ProfessionalBadgeController, ProfessionalController, ProfessionalProfileController } from 'core/controllers/Professional';
import { webUrl } from 'core/domain/WebUrl';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { EmailService, recipientLocale } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';
import { professionalBadgeCodeEmail } from '../../email/templates/ProfessionalBadgeCode.js';
import { professionalBadgeRemovedEmail } from '../../email/templates/ProfessionalBadgeRemoved.js';
import { professionalClosingEmail } from '../../email/templates/ProfessionalClosing.js';
import { professionalProfileHiddenEmail } from '../../email/templates/ProfessionalProfileHidden.js';
import { professionalSuspendedEmail } from '../../email/templates/ProfessionalSuspended.js';
import { professionalSuspensionLiftedEmail } from '../../email/templates/ProfessionalSuspensionLifted.js';

import type { Env } from '../../../config/index.js';
import type { BadgeRemoval, PracticeRestrictionAct, ProfileHiding } from 'core/controllers/Professional';
import type { RenderedEmail } from '../../email/templates/Layout.js';
import type {
  HideProfessionalProfileDto,
  IssueBadgeCodeDto,
  LiftRestrictionDto,
  ProfessionalsQueryDto,
  RemoveBadgeDto,
  RestrictPracticeDto
} from '../dto/in/index.js';
import type {
  BadgeCodeIssuedDto,
  BadgeQueueDto,
  BadgeRecordDto,
  PracticeRestrictionAnswerDto,
  ProfessionalsDto,
  ProfileQueueDto,
  QueuedProfileDto
} from '../dto/out/index.js';

/**
 * The owner's acts on practitioners (`0059`, project 025): the badge, the
 * profile's first look, and the restrictions. Every rule is in core; this is
 * the seam, and the one place their mails are queued.
 *
 * **A mail never undoes an act** (PLAN 025 phase 6 step 7): each statement of
 * reasons goes in the background, after the act committed; one that fails is
 * logged by its kind alone — never an address, a name or the owner's words —
 * and the statement stays readable on the practitioner's own page.
 */
@Injectable()
export class AdminProfessionalsService {
  private readonly logger = new Logger(AdminProfessionalsService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly background: BackgroundTaskService,
    private readonly email: EmailService
  ) {}

  async badge(userId: string): Promise<BadgeRecordDto> {
    return ProfessionalBadgeController.record(userId);
  }

  async badges(): Promise<BadgeQueueDto> {
    return ProfessionalBadgeController.queue();
  }

  /**
   * The owner closes a practice with 30 days' notice (`textos/06` § W bis.3):
   * the notice, with its reasons and the day, is mailed at once.
   */
  async close(userId: string, body: RestrictPracticeDto, ownerId: string): Promise<PracticeRestrictionAnswerDto> {
    const act = await ProfessionalController.close(userId, ownerId, body);

    this.background.run('practice-closing-mail', async () => this.restrictionMail(act));

    return act.answer;
  }

  async confirmBadge(userId: string, ownerId: string): Promise<BadgeRecordDto> {
    return ProfessionalBadgeController.confirm(userId, ownerId);
  }

  /** The owner hides a profile — refusing is the same act — and the statement of reasons is mailed (`textos/06` § X). */
  async hideProfile(userId: string, body: HideProfessionalProfileDto): Promise<QueuedProfileDto> {
    const hiding = await ProfessionalProfileController.hide(userId, body);

    this.background.run('profile-hidden-mail', async () => this.hidingMail(hiding));

    return hiding.profile;
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
   * The owner lifts what stands (`textos/06` § W bis.2). The lifting is mailed
   * only when it lifted a suspension: the approved words say «Hemos levantado la
   * suspensión», and there are none yet for a close withdrawn on its own — the
   * practitioner's page says it either way.
   */
  async lift(userId: string, body: LiftRestrictionDto, ownerId: string): Promise<PracticeRestrictionAnswerDto> {
    const act = await ProfessionalController.lift(userId, ownerId, body);

    if (act.wasSuspended) {
      this.background.run('practice-lifted-mail', async () => this.restrictionMail(act));
    }

    return act.answer;
  }

  async list(query: ProfessionalsQueryDto): Promise<ProfessionalsDto> {
    return ProfessionalController.list(query);
  }

  /** The owner has looked at a queued profile and found nothing to hide. Nothing is mailed: «seen» is not an approval. */
  async markProfileSeen(userId: string, ownerId: string): Promise<QueuedProfileDto> {
    return ProfessionalProfileController.markSeen(userId, ownerId);
  }

  async profiles(): Promise<ProfileQueueDto> {
    return ProfessionalProfileController.queue();
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

  /** The owner suspends an account as a practitioner, at once (`textos/06` § W bis.1); the statement is mailed. */
  async suspend(userId: string, body: RestrictPracticeDto, ownerId: string): Promise<PracticeRestrictionAnswerDto> {
    const act = await ProfessionalController.suspend(userId, ownerId, body);

    this.background.run('practice-suspended-mail', async () => this.restrictionMail(act));

    return act.answer;
  }

  /** § X, in the practitioner's own language, to their own address. */
  private async hidingMail(hiding: ProfileHiding): Promise<void> {
    const locale = await recipientLocale(hiding.userId);
    const { afterNotice, facts, reasons, word } = hiding.statement;

    await this.deliver(professionalProfileHiddenEmail({ afterNotice, facts, locale, reasons, word }), hiding.to);
  }

  /** § W bis's three mails, in the practitioner's own language, to their own address. */
  private async restrictionMail(act: PracticeRestrictionAct): Promise<void> {
    const locale = await recipientLocale(act.userId);
    const { authority, clause, facts, source } = act.statement;

    switch (act.kind) {
      case 'suspended':
        if (facts !== null && source !== null) {
          await this.deliver(professionalSuspendedEmail({ locale, statement: { authority, clause, facts, source } }), act.to);
        }

        return;
      case 'closing':
        if (facts !== null && source !== null && act.closesAt !== null) {
          await this.deliver(
            professionalClosingEmail({ closesAt: act.closesAt, locale, statement: { authority, clause, facts, source }, suspended: act.suspended }),
            act.to
          );
        }

        return;
      case 'lifted':
        await this.deliver(professionalSuspensionLiftedEmail({ facts, locale }), act.to);

        return;
    }
  }

  /** Sends one statement. Never logs the address or the owner's words: a failure says only which kind did not go. */
  private async deliver(mail: RenderedEmail, to: string): Promise<void> {
    if (!(await this.email.send({ ...mail, to }))) {
      this.logger.warn(`${mail.kind} mail not sent`);
    }
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
}
