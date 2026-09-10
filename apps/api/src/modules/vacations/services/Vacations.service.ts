import { Injectable } from '@nestjs/common';

import { VacationController } from 'core/controllers/Vacation';

import type { PlanVacationDto } from '../dto/in/index.js';
import type { VacationDto } from '../dto/out/index.js';

@Injectable()
export class VacationsService {
  async cancel(userId: string, id: string): Promise<void> {
    await VacationController.cancel(userId, id);
  }

  async list(userId: string): Promise<readonly VacationDto[]> {
    return VacationController.list(userId);
  }

  async plan(userId: string, body: PlanVacationDto): Promise<VacationDto> {
    return VacationController.plan(userId, body);
  }
}
