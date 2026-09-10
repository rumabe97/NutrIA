import { Injectable } from '@nestjs/common';

import { SafetyController } from 'core/controllers/Safety';

import type { AllergenDto, RestrictionsDto } from '../dto/out/index.js';
import type { SetAllergiesDto } from '../dto/in/index.js';

@Injectable()
export class SafetyService {
  async listAllergens(): Promise<readonly AllergenDto[]> {
    return SafetyController.listAllergens();
  }

  async restrictions(userId: string): Promise<RestrictionsDto> {
    return SafetyController.getRestrictions(userId);
  }

  async setRestrictions(userId: string, body: SetAllergiesDto): Promise<void> {
    await SafetyController.setRestrictions(userId, body);
  }
}
