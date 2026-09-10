import { Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CheckInsService } from '../services/index.js';
import { CurrentUser, RequiresOnboarding, ZodBody } from '../../../shared/index.js';
import { SubmitCheckInDto } from '../dto/in/index.js';

import type { CheckInResultDto, CheckInStatusDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

@ApiTags('check-ins')
@Controller('check-ins')
@RequiresOnboarding()
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  @ApiOkResponse({ description: 'Whether it is due, whether it is done, and how the fortnight went.' })
  @ApiOperation({ summary: "Whether the fortnight's check-in is due, done, and how the fortnight went" })
  @Get('status')
  async status(@CurrentUser() user: SessionUser): Promise<CheckInStatusDto> {
    return this.checkIns.status(user.id);
  }

  @ApiCreatedResponse({ description: 'What the answers changed. Never a restriction.' })
  @ApiOperation({ summary: 'Close the fortnight: weight to the log, portions to the targets, words to the next plan. Once per plan.' })
  @Post()
  async submit(@CurrentUser() user: SessionUser, @ZodBody(SubmitCheckInDto) body: SubmitCheckInDto): Promise<CheckInResultDto> {
    return this.checkIns.submit(user.id, body);
  }
}
