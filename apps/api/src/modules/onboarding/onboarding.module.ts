import { Module } from '@nestjs/common';

import { OnboardingRestController } from './onboarding.controller.js';

@Module({ controllers: [OnboardingRestController] })
export class OnboardingModule {}
