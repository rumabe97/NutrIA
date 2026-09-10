import { Injectable } from '@nestjs/common';

import { HealthController } from 'core/controllers/Health';

import type { HealthDto } from '../dto/out/index.js';
import type { SetHealthDataDto } from '../dto/in/index.js';

@Injectable()
export class HealthDataService {
  async read(userId: string): Promise<HealthDto> {
    return HealthController.get(userId);
  }

  async replace(userId: string, body: SetHealthDataDto): Promise<HealthDto> {
    return HealthController.replace(userId, body);
  }

  async withdraw(userId: string): Promise<HealthDto> {
    return HealthController.withdraw(userId);
  }
}
