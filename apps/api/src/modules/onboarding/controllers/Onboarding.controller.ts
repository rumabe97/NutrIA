import { Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { OnboardingService } from '../services/index.js';
import { OnboardingStepDto } from '../dto/in/index.js';

import type { OnboardingDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @ApiOkResponse({ description: 'Which steps are done, and the step to resume at.' })
  @ApiOperation({ summary: 'Which steps are done and where to resume' })
  @Get()
  async state(@CurrentUser() user: SessionUser): Promise<OnboardingDto> {
    return this.onboarding.state(user.id);
  }

  @ApiOkResponse({ description: 'The state after the step, so the client never guesses what comes next.' })
  @ApiOperation({ summary: 'Save one onboarding step' })
  @Patch()
  async saveStep(@CurrentUser() user: SessionUser, @ZodBody(OnboardingStepDto) body: OnboardingStepDto): Promise<OnboardingDto> {
    return this.onboarding.saveStep(user.id, body);
  }

  @ApiCreatedResponse({ description: 'Closed. Refused, with the missing step named, while one is outstanding.' })
  @ApiOperation({ summary: 'Close onboarding once every required step is done' })
  @Post('complete')
  async complete(@CurrentUser() user: SessionUser): Promise<OnboardingDto> {
    return this.onboarding.complete(user.id);
  }
}
