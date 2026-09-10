import { Injectable } from '@nestjs/common';

import { OnboardingController } from 'core/controllers/Onboarding';

import type { OnboardingDto } from '../dto/out/index.js';
import type { OnboardingStepDto } from '../dto/in/index.js';

@Injectable()
export class OnboardingService {
  async complete(userId: string): Promise<OnboardingDto> {
    return OnboardingController.complete(userId);
  }

  async saveStep(userId: string, body: OnboardingStepDto): Promise<OnboardingDto> {
    return OnboardingController.saveStep(userId, body);
  }

  async state(userId: string): Promise<OnboardingDto> {
    return OnboardingController.getState(userId);
  }
}
