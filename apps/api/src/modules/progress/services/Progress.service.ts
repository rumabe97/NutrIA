import { Injectable } from '@nestjs/common';

import { ProgressController } from 'core/controllers/Progress';

import type { LogWeightDto } from '../dto/in/index.js';
import type { ProgressSummaryDto, WeightDto } from '../dto/out/index.js';

@Injectable()
export class ProgressService {
  async logWeight(userId: string, body: LogWeightDto): Promise<WeightDto> {
    return ProgressController.logWeight(userId, body);
  }

  async summary(userId: string): Promise<ProgressSummaryDto> {
    return ProgressController.summary(userId);
  }

  async weight(userId: string): Promise<WeightDto> {
    return ProgressController.getWeight(userId);
  }
}
