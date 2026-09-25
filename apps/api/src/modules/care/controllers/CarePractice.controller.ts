import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AcceptAgreementDto } from '../dto/in/index.js';
import { BeforePractice, CurrentUser, ZodBody } from '../../../shared/index.js';
import { CareService } from '../services/index.js';
import { ProfessionalGuard } from '../../../shared/guards/Professional.guard.js';

import type { CarePracticeDto } from '../dto/out/index.js';
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
}
