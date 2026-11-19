import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowUnverified, CurrentUser, Locale, ZodBody } from '../../../shared/index.js';
import { CareService } from '../services/index.js';
import { OpenPracticeDto } from '../dto/in/index.js';
import { ProfessionalSwitchGuard } from '../../../shared/guards/ProfessionalSwitch.guard.js';

import type { CarePracticeDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * **Anyone can open a practice** (PRD 025 scope 1, criterion 1): the session's
 * account opens its own, free, with nothing from the body but a birth date.
 *
 * Its own controller because the door is not `ProfessionalGuard` — the account
 * has no practice yet — but the switch alone (`ProfessionalSwitchGuard`, a 404
 * while it is off, before any pipe can answer 422).
 *
 * `@AllowUnverified()` on purpose: an unconfirmed address, or an account the
 * owner has not opened, must get **the same 404** as every other refusal here,
 * not the global 409 that says which lock is missing — the core asks both and
 * answers 404 (criterion 1). The other refusals, the same 404 and nothing
 * written: no birth date on record and none given, under 18, a suspension or a
 * close standing (criterion 24). An account that already practises is answered
 * with its practice, and nothing is written.
 */
@ApiTags('care')
@Controller('care')
@UseGuards(ProfessionalSwitchGuard)
export class CareOpenPracticeController {
  constructor(private readonly care: CareService) {}

  @ApiOkResponse({
    description:
      'The practice, open — or as it already stood: nothing is written twice. 404 — one body for every refusal — with the switch off, an address not confirmed, no birth date of 18 or more on record or given, or a suspension or close standing. 422 for a malformed birth date.'
  })
  @ApiOperation({ summary: 'Open one’s own practice (project 025)' })
  @AllowUnverified()
  @HttpCode(HttpStatus.OK)
  @Post('practice')
  async open(
    @CurrentUser() user: SessionUser,
    @ZodBody(OpenPracticeDto) body: OpenPracticeDto,
    @Locale() locale: string | null
  ): Promise<CarePracticeDto> {
    return this.care.openPractice(user, body, locale);
  }
}
