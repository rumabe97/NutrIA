import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { OnboardingController as OnboardingService } from 'core/controllers/Onboarding';
import { onboardingStepSchema } from 'core/entities/Onboarding';

import { CurrentUser } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { OnboardingView } from 'core/controllers/Onboarding';
import type { OnboardingStepInput } from 'core/entities/Onboarding';
import type { SessionUser } from '../../shared/decorators/index.js';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingRestController {
  @ApiOperation({ summary: 'Which steps are done and where to resume' })
  @Get()
  async state(@CurrentUser() user: SessionUser): Promise<OnboardingView> {
    return OnboardingService.getState(user.id);
  }

  @ApiOperation({ summary: 'Save one onboarding step' })
  @Patch()
  async saveStep(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(onboardingStepSchema)) body: OnboardingStepInput): Promise<OnboardingView> {
    // One step per request. The discriminated union means a step can only carry
    // its own fields, and each save is independently valid — which is what makes
    // the flow resumable from another device mid-way through.
    return OnboardingService.saveStep(user.id, body);
  }

  @ApiOperation({ summary: 'Close onboarding once every required step is done' })
  @Post('complete')
  async complete(@CurrentUser() user: SessionUser): Promise<OnboardingView> {
    return OnboardingService.complete(user.id);
  }
}
