import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CheckInController } from 'core/controllers/CheckIn';
import { submitCheckInSchema } from 'core/entities/CheckIn';

import { CurrentUser, RequiresOnboarding } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { CheckInResultView, CheckInStatusView } from 'core/controllers/CheckIn';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { SubmitCheckIn } from 'core/entities/CheckIn';

@ApiTags('check-ins')
@Controller('check-ins')
@RequiresOnboarding()
export class CheckInsController {
  @ApiOperation({ summary: "Whether the fortnight's check-in is due, done, and how the fortnight went" })
  @Get('status')
  async status(@CurrentUser() user: SessionUser): Promise<CheckInStatusView> {
    return CheckInController.status(user.id);
  }

  @ApiOperation({ summary: 'Close the fortnight: weight to the log, portions to the targets, words to the next plan. Once per plan.' })
  @Post()
  async submit(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(submitCheckInSchema)) body: SubmitCheckIn): Promise<CheckInResultView> {
    return CheckInController.submit(user.id, body);
  }
}
