import { Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AcceptAgreementDto, ApplyForBadgeDto, EnterBadgeCodeDto, SaveProfessionalProfileDto } from '../dto/in/index.js';
import { BeforePractice, CurrentUser, ZodBody } from '../../../shared/index.js';
import { CareService } from '../services/index.js';
import { ProfessionalGuard } from '../../../shared/guards/Professional.guard.js';

import type { CareBadgeDto, CarePracticeDto, CareProfessionalProfileDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The workspace's own page (`0061`, PRD 025): whether a practice plan is paid
 * for, the seats in force and how many are taken, the plans to pay with, what
 * the owner has standing against the practice — and whether the professional's
 * agreement is still to be accepted (`docs/legal/textos/01`), which is accepted
 * here too.
 *
 * `ProfessionalGuard` — the switch and a practice, anything else a 404 — but
 * `@BeforePractice()`: a practitioner who has not accepted the agreement, or is
 * suspended, must still reach the page that says so and the route that accepts
 * it. Counts and prices only; nothing here names a client, so it writes no row
 * in anybody's trail. Never `@RequiresOnboarding()`, as the rest of the
 * workspace. Opening a practice is `CareOpenPracticeController`: an account
 * with none cannot pass this guard.
 *
 * **The profile** (project 025 phase 6): the practitioner's own, read and saved
 * by the session's account, in the same before-practice lane. Its words are
 * judged with the badge, server-side.
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

  @ApiOkResponse({
    description:
      'The practitioner’s own profile, or null before one is written: the review state (`queued` or `seen`, never approved), the owner’s statement while hidden, and the fields withheld for a word the badge alone allows.'
  })
  @ApiOperation({ summary: 'The practitioner’s profile (project 025)' })
  @BeforePractice()
  @Get('practice/profile')
  async profile(@CurrentUser() professional: SessionUser): Promise<CareProfessionalProfileDto> {
    return this.care.profile(professional);
  }

  @ApiOkResponse({
    description:
      'Saved, and back on the owner’s queue when it is new or a text changed. 422 INVALID_INPUT for a malformed body, or for a word the profile may not carry — `fieldErrors: { <field>: ["<badge_only|never|result>:<word>"] }` — and then nothing is written.'
  })
  @ApiOperation({ summary: 'Save the practitioner’s profile, its words judged with the badge' })
  @BeforePractice()
  @Put('practice/profile')
  async saveProfile(
    @CurrentUser() professional: SessionUser,
    @ZodBody(SaveProfessionalProfileDto) body: SaveProfessionalProfileDto
  ): Promise<NonNullable<CareProfessionalProfileDto>> {
    return this.care.saveProfile(professional, body);
  }
}
