import { Module } from '@nestjs/common';

import { OnboardingController } from './controllers/index.js';
import { OnboardingService } from './services/index.js';

@Module({ controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}
