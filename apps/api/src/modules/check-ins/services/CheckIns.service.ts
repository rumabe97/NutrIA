import { Injectable } from '@nestjs/common';

import { CheckInController } from 'core/controllers/CheckIn';

import type { CheckInResultDto, CheckInStatusDto } from '../dto/out/index.js';
import type { SubmitCheckInDto } from '../dto/in/index.js';

@Injectable()
export class CheckInsService {
  async status(userId: string): Promise<CheckInStatusDto> {
    return CheckInController.status(userId);
  }

  async submit(userId: string, body: SubmitCheckInDto): Promise<CheckInResultDto> {
    return CheckInController.submit(userId, body);
  }
}
