import { Inject, Injectable, Logger } from '@nestjs/common';

import { CareController } from 'core/controllers/Care';
import { ProfessionalBadgeController, ProfessionalController, ProfessionalProfileController } from 'core/controllers/Professional';
import { UserController } from 'core/controllers/User';
import { webUrl } from 'core/domain/WebUrl';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { careInvitationEmail } from '../../email/templates/CareInvitation.js';
import { EmailService, recipientLocale } from '../../email/services/index.js';
import { ENV } from '../../../config/index.js';
import { BillingService } from '../../billing/services/index.js';
import { MealSwapService, PlanJobRunner } from '../../meal-plans/index.js';

import type {
  AcceptAgreementDto,
  AcceptInvitationDto,
  ApplyForBadgeDto,
  EnterBadgeCodeDto,
  InviteClientDto,
  OpenPracticeDto,
  ReconsentLinkDto,
  SaveProfessionalProfileDto,
  SetClientReviewDto,
  SetClientTargetsDto,
  SetLinkHealthDto,
  SwapClientMealDto
} from '../dto/in/index.js';
import type {
  CareAccessPageDto,
  CareBadgeDto,
  CareClientJobDto,
  CareClientLinkDto,
  CareClientMealDto,
  CareClientOverviewDto,
  CareClientPlanDto,
  CareClientsDto,
  CareClientTargetsDto,
  CareEndedLinkDto,
  CareInvitationDetailDto,
  CareInvitationDto,
  CareLinkDto,
  CarePracticeDto,
  CareProfessionalProfileDto
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
    private readonly billing: BillingService,
    private readonly email: EmailService,
    private readonly runner: PlanJobRunner,
    private readonly swaps: MealSwapService
  ) {}

  async acceptAgreement(professional: SessionUser, body: AcceptAgreementDto): Promise<void> {
    await ProfessionalController.acceptAgreement(professional.id, body);
  }

  /**
   * The account opens its own practice (PRD 025 scope 1), and is answered with
   * the practice's page as it now stands — the same answer an account that
   * already practises gets. Every refusal is the core's 404.
   */
  async openPractice(user: SessionUser, body: OpenPracticeDto, locale: string | null): Promise<CarePracticeDto> {
    await ProfessionalController.open(user.id, body, locale);

    return this.practice(user);
  }

  async profile(professional: SessionUser): Promise<CareProfessionalProfileDto> {
    return ProfessionalProfileController.mine(professional.id);
  }

  async saveProfile(professional: SessionUser, body: SaveProfessionalProfileDto): Promise<NonNullable<CareProfessionalProfileDto>> {
    return ProfessionalProfileController.save(professional.id, body);
  }

  async accept(user: SessionUser, token: string, body: AcceptInvitationDto): Promise<CareLinkDto> {
    return CareController.accept(user, token, body);
  }

  async applyForBadge(professional: SessionUser, body: ApplyForBadgeDto): Promise<CareBadgeDto> {
    return ProfessionalBadgeController.apply(professional.id, body);
  }

  async badge(professional: SessionUser): Promise<CareBadgeDto> {
    return ProfessionalBadgeController.state(professional.id);
  }

  async enterBadgeCode(professional: SessionUser, body: EnterBadgeCodeDto): Promise<void> {
    await ProfessionalBadgeController.enterCode(professional.id, body);
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

  /**
   * Through `CareController.generatePlan`: the client's id reaches the runner
   * only inside `withClient`, with the write's `record` (`0060`).
   */
  async generatePlan(professional: SessionUser, linkId: string): Promise<CareClientJobDto> {
    return CareController.generatePlan(professional, linkId, (clientId, record) => this.runner.start(clientId, record));
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
    const { invitation, inviterName, token } = await CareController.invite(professional, body);

    // The name the core judged in the invitation's transaction — never the session's copy of it.
    this.background.run('care-invitation-mail', async () => this.mail(professional, inviterName, invitation.email, token));

    return invitation;
  }

  async myLink(user: SessionUser): Promise<CareLinkDto | null> {
    return CareController.myLink(user);
  }

  /** The client's own last link, when the illness rule's sweep ended it (`0111` § 8); nothing is sent to anybody. */
  async endedLink(user: SessionUser): Promise<CareEndedLinkDto | null> {
    return CareController.endedLink(user);
  }

  /** The client widens their own link to the badged list (`docs/legal/textos/05` § F.4); nothing is sent to anybody. */
  async reconsent(user: SessionUser, body: ReconsentLinkDto): Promise<CareLinkDto> {
    return CareController.reconsent(user, body);
  }

  /** Through `CareController.withClient`, inside the core call: the client's id never reaches this app. */
  async overview(professional: SessionUser, linkId: string, locale: string | null): Promise<CareClientOverviewDto> {
    return CareController.overview(professional, linkId, locale);
  }

  async pendingPlan(professional: SessionUser, linkId: string, locale: string | null): Promise<CareClientPlanDto | null> {
    return CareController.pendingPlan(professional, linkId, locale);
  }

  async planJob(professional: SessionUser, linkId: string, jobId: string): Promise<CareClientJobDto> {
    return CareController.planJob(professional, linkId, jobId);
  }

  /**
   * The practice's standing from core, the way to pay from billing, and whether
   * the second factor still bars the client routes (PLAN 011 phase 6) — the
   * question `ProfessionalGuard` asks, asked the same way. Counts and prices,
   * never a client.
   */
  async practice(professional: SessionUser): Promise<CarePracticeDto> {
    const [standing, billing, secondFactorRequired] = await Promise.all([
      CareController.practice(professional),
      this.billing.practiceOffer(professional),
      UserController.needsSecondFactor(professional)
    ]);

    return { ...standing, billing, secondFactorRequired };
  }

  async publishPlan(professional: SessionUser, linkId: string, locale: string | null): Promise<CareClientPlanDto> {
    return CareController.publishPlan(professional, linkId, locale);
  }

  async setSharesHealth(user: SessionUser, body: SetLinkHealthDto): Promise<CareLinkDto> {
    return CareController.setSharesHealth(user, body);
  }

  async setReview(professional: SessionUser, linkId: string, body: SetClientReviewDto): Promise<CareClientLinkDto> {
    return CareController.setReview(professional, linkId, body);
  }

  /** Through `CareController.swapPendingMeal`: the client's own swap, on the plan under review only (`0060`). */
  async swapMeal(
    professional: SessionUser,
    linkId: string,
    mealId: string,
    locale: string | null,
    body: SwapClientMealDto
  ): Promise<CareClientMealDto> {
    return CareController.swapPendingMeal(professional, linkId, mealId, (clientId, record) =>
      this.swaps.swap(clientId, mealId, locale, body.axis, { record })
    );
  }

  /** Through `CareController.withClient` too: the professional as the setter, the client's own bounds. */
  async setTargets(professional: SessionUser, linkId: string, body: SetClientTargetsDto): Promise<CareClientTargetsDto> {
    return CareController.setTargets(professional, linkId, body);
  }

  /**
   * In the inviter's language: the recipient may have no account, so theirs is
   * unknown. Never logs the address or the token — a failure says only that
   * an invitation mail did not go.
   */
  private async mail(professional: SessionUser, inviterName: string, to: string, token: string): Promise<void> {
    const locale = await recipientLocale(professional.id);
    const url = webUrl(this.env.APP_URL, `/invitacion/${token}`, locale);
    const privacyUrl = webUrl(this.env.APP_URL, '/privacidad', locale);
    const sent = await this.email.send({ ...careInvitationEmail({ inviterName, locale, privacyUrl, url }), to });

    if (!sent) {
      this.logger.warn('care invitation mail not sent');
    }
  }
}
