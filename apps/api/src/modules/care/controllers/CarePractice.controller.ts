import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AcceptAgreementDto, ApplyForBadgeDto, EnterBadgeCodeDto } from '../dto/in/index.js';
import { BeforePractice, CurrentUser, ZodBody } from '../../../shared/index.js';
import { CareService } from '../services/index.js';
import { ProfessionalGuard } from '../../../shared/guards/Professional.guard.js';

import type { CareBadgeDto, CarePracticeDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The workspace's own page (`0061`): whether the practice is paid for, how
 * many clients it includes and how many seats are taken, the plans to pay
 * with — and whether the professional's agreement is still to be accepted
 * (`docs/legal/textos/01`), which is accepted here too.
 *
 * `ProfessionalGuard` — the switch and the grant, anything else a 404 — but
 * `@BeforePractice()`: a professional whose practice is not paid for, or who
 * has not accepted the agreement, must still reach the page that shows both
 * and the route that accepts it. Counts and prices only;
 * nothing here names a client, so it writes no row in anybody's trail. Never
 * `@RequiresOnboarding()`, as the rest of the workspace.
 *
 * **The badge** (project 025 phase 3): the practitioner's own badge, their
 * application and the code they were sent, in the same before-practice lane —
 * the badge is how a practice comes to see more, so it cannot wait behind the
 * doors it opens. Every one of them is by the session's account alone: no body
 * or path names a user, and no body carries a contact. A wrong, used, expired
 * or unknown code is the same 404 as anything else refused.
 */
@ApiTags('care')
@Controller('care')
@UseGuards(ProfessionalGuard)
export class CarePracticeController {
  constructor(private readonly care: CareService) {}

  @ApiOkResponse({ description: 'Whether the practice is paid for, the clients it includes and those in use, and the practice plans on offer.' })
  @ApiOperation({ summary: 'The professional’s practice and the way to pay for it' })
  @BeforePractice()
  @Get('practice')
  async practice(@CurrentUser() professional: SessionUser): Promise<CarePracticeDto> {
    return this.care.practice(professional);
  }

  @ApiNoContentResponse({
    description: 'Accepted. 422 for any version but the current one; 404 unless the switch is on and the account is a professional.'
  })
  @ApiOperation({ summary: 'Accept the professional’s agreement and the practice plan’s terms, at the current version' })
  @BeforePractice()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('practice/agreement')
  async acceptAgreement(@CurrentUser() professional: SessionUser, @ZodBody(AcceptAgreementDto) body: AcceptAgreementDto): Promise<void> {
    await this.care.acceptAgreement(professional, body);
  }

  @ApiOkResponse({ description: 'The practitioner’s own badge: none, applied, code sent, badged, due or lapsed, with its dates. Never the code.' })
  @ApiOperation({ summary: 'Where the practitioner’s badge stands' })
  @BeforePractice()
  @Get('practice/badge')
  async badge(@CurrentUser() professional: SessionUser): Promise<CareBadgeDto> {
    return this.care.badge(professional);
  }

  @ApiCreatedResponse({ description: 'Applied: the badge as it now stands. 404 while a badge stands; 422 for a malformed register or number.' })
  @ApiOperation({ summary: 'Apply for the badge with a register and a number' })
  @BeforePractice()
  @Post('practice/badge')
  async applyForBadge(@CurrentUser() professional: SessionUser, @ZodBody(ApplyForBadgeDto) body: ApplyForBadgeDto): Promise<CareBadgeDto> {
    return this.care.applyForBadge(professional, body);
  }

  @ApiNoContentResponse({
    description: 'The code was right and is spent; the owner confirms next. Any refusal — wrong, used, expired, too many tries, none — is 404.'
  })
  @ApiOperation({ summary: 'Enter the badge’s code' })
  @BeforePractice()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('practice/badge/code')
  async enterBadgeCode(@CurrentUser() professional: SessionUser, @ZodBody(EnterBadgeCodeDto) body: EnterBadgeCodeDto): Promise<void> {
    await this.care.enterBadgeCode(professional, body);
  }
}
