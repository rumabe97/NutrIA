import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BeforePractice, CurrentUser } from '../../../shared/index.js';
import { CareService } from '../services/index.js';
import { ProfessionalGuard } from '../../../shared/guards/Professional.guard.js';

import type { CarePracticeDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The workspace's own page (`0061`): whether the practice is paid for, how
 * many clients it includes and how many seats are taken, and the plans to pay
 * with.
 *
 * `ProfessionalGuard` — the switch and the grant, anything else a 404 — but
 * `@BeforePractice()`: a professional whose practice is not paid for must
 * still reach the page that shows the way to pay. Counts and prices only;
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
}
