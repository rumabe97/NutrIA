import { Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CareService } from '../services/index.js';
import { CurrentUser, Locale, RateLimit, ZodBody } from '../../../shared/index.js';
import { SetClientReviewDto, SetClientTargetsDto, SwapClientMealDto } from '../dto/in/index.js';
import { ProfessionalGuard } from '../../../shared/guards/Professional.guard.js';

import type {
  CareClientJobDto,
  CareClientLinkDto,
  CareClientMealDto,
  CareClientOverviewDto,
  CareClientPlanDto,
  CareClientsDto,
  CareClientTargetsDto
} from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The professional reading their clients (`0059`, project 004 Phase 3).
 *
 * `ProfessionalGuard` on the class — the switch and the grant, read per
 * request, anything else a 404 before any pipe runs — and never
 * `@RequiresOnboarding()`. A route takes a **link** id, never a client's: the
 * client's id exists only inside `CareController.withClient`, which resolves
 * the link against the session and writes the client's trail. No
 * `ParseUUIDPipe`: a path that is not a link id is the same 404 as a link that
 * is not the caller's.
 */
@ApiTags('care')
@Controller('care')
@UseGuards(ProfessionalGuard)
export class CareClientsController {
  constructor(private readonly care: CareService) {}

  @ApiOkResponse({
    description:
      'Each client with an open link and where they are, and the invitations still unanswered. Writes one `list` row in the trail of every client with an active link.'
  })
  @ApiOperation({ summary: 'The professional’s clients' })
  @Get('clients')
  // Every call writes a row in each active client's trail: a tighter limit than the global
  // one keeps a burst of list calls from burying an earlier read pages deep.
  @RateLimit({ limit: 10, ttlSeconds: 60 })
  async clients(@CurrentUser() professional: SessionUser): Promise<CareClientsDto> {
    return this.care.clients(professional);
  }

  @ApiOkResponse({
    description:
      'The client’s plan and plan history, progress and targets; `health` only under the link’s health line, absent otherwise. One `overview` row in the client’s trail, and one `health` row when health is included. 404 for any link that is not the caller’s and active.'
  })
  @ApiOperation({ summary: 'One client’s page, through their link' })
  @Get('clients/:linkId')
  async overview(
    @CurrentUser() professional: SessionUser,
    @Param('linkId') linkId: string,
    @Locale() locale: string | null
  ): Promise<CareClientOverviewDto> {
    return this.care.overview(professional, linkId, locale);
  }

  /**
   * The client's own `PATCH /profiles/targets`, set by their professional (PRD
   * 004, criterion 7): the same body, the same bounds, the same refusal — 422
   * `INVALID_INPUT` with the sentence under `fieldErrors.targets` — and the same answer,
   * whose `setBy` names the professional. One `targets` `write` row in the
   * client's trail, written before the change.
   */
  @ApiOkResponse({
    description:
      'The client’s resolved targets, `setBy` naming the professional. 422 `INVALID_INPUT` with the same field errors as the client’s own route when a value is out of bounds. One `targets` write row in the client’s trail. 404 for any link that is not the caller’s and active.'
  })
  @ApiOperation({ summary: 'Set a client’s daily targets, through their link' })
  @Patch('clients/:linkId/targets')
  async setTargets(
    @CurrentUser() professional: SessionUser,
    @Param('linkId') linkId: string,
    @ZodBody(SetClientTargetsDto) body: SetClientTargetsDto
  ): Promise<CareClientTargetsDto> {
    return this.care.setTargets(professional, linkId, body);
  }

  @ApiOkResponse({
    description:
      'The link with review before publishing as it now is. A plan already pending stays pending. One `review` write row in the client’s trail. 404 for any link that is not the caller’s and active.'
  })
  @ApiOperation({ summary: 'Turn review before publishing on or off for one client' })
  @Patch('clients/:linkId')
  async setReview(
    @CurrentUser() professional: SessionUser,
    @Param('linkId') linkId: string,
    @ZodBody(SetClientReviewDto) body: SetClientReviewDto
  ): Promise<CareClientLinkDto> {
    return this.care.setReview(professional, linkId, body);
  }

  @ApiOkResponse({
    description:
      'The plan waiting for review, in the shape `GET /meal-plans/:id` answers, or null. One `review` read row in the client’s trail. 404 for any link that is not the caller’s and active.'
  })
  @ApiOperation({ summary: 'The client’s plan waiting for review (`0060`)' })
  @Get('clients/:linkId/plan/pending')
  async pendingPlan(
    @CurrentUser() professional: SessionUser,
    @Param('linkId') linkId: string,
    @Locale() locale: string | null
  ): Promise<CareClientPlanDto | null> {
    return this.care.pendingPlan(professional, linkId, locale);
  }

  @ApiCreatedResponse({
    description:
      'A job to poll. Generates the client’s plan — a first one, or the next fortnight once the active one has ended — or regenerates the one under review, which it replaces; counted against the client’s allowance as their own would be — 429 `QUOTA_EXCEEDED`, 409 `CONFLICT` when a generation (the client’s or this one) is already running. A fortnight still running is 404, as for any link not the caller’s. One `review` write row, only when the job starts.'
  })
  @ApiOperation({ summary: 'Generate the client’s plan or next fortnight, or regenerate the one under review' })
  @Post('clients/:linkId/plan/generate')
  // The client's own limit on the same work: it costs money and minutes.
  @RateLimit({ limit: 3, ttlSeconds: 3600 })
  async generatePlan(@CurrentUser() professional: SessionUser, @Param('linkId') linkId: string): Promise<CareClientJobDto> {
    return this.care.generatePlan(professional, linkId);
  }

  @ApiOkResponse({
    description: 'The job, with the plan it made even while that plan waits for review. One `review` read row. 404 for a job of anybody else.'
  })
  @ApiOperation({ summary: 'Progress of a generation for the client' })
  @Get('clients/:linkId/plan/jobs/:jobId')
  async planJob(@CurrentUser() professional: SessionUser, @Param('linkId') linkId: string, @Param('jobId') jobId: string): Promise<CareClientJobDto> {
    return this.care.planJob(professional, linkId, jobId);
  }

  @ApiCreatedResponse({
    description:
      'The meal that replaced it. Only a meal of the plan under review — any other is 404. Counted against that plan’s swaps: 429 `QUOTA_EXCEEDED` when spent. One `review` write row, with the change.'
  })
  @ApiOperation({ summary: 'Swap one meal of the plan under review' })
  @Post('clients/:linkId/plan/meals/:mealId/swap')
  // The client's own limit on the same work.
  @RateLimit({ limit: 10, ttlSeconds: 3600 })
  async swapMeal(
    @CurrentUser() professional: SessionUser,
    @Param('linkId') linkId: string,
    @Param('mealId') mealId: string,
    @Locale() locale: string | null,
    @ZodBody(SwapClientMealDto) body: SwapClientMealDto
  ): Promise<CareClientMealDto> {
    return this.care.swapMeal(professional, linkId, mealId, locale, body);
  }

  @ApiOkResponse({
    description:
      'The plan now active for the client. The previous active plan is completed in the same transaction. One `review` write row, with the change. 404 when nothing is pending.'
  })
  @ApiOperation({ summary: 'Publish the plan under review to the client' })
  @HttpCode(200)
  @Post('clients/:linkId/plan/publish')
  async publishPlan(
    @CurrentUser() professional: SessionUser,
    @Param('linkId') linkId: string,
    @Locale() locale: string | null
  ): Promise<CareClientPlanDto> {
    return this.care.publishPlan(professional, linkId, locale);
  }
}
