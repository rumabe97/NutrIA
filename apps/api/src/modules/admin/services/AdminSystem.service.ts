import { Inject, Injectable } from '@nestjs/common';

import { AdminSystemController } from 'core/controllers/Admin';

import { EmailService } from '../../email/services/Email.service.js';
import { ENV } from '../../../config/index.js';
import { PushService } from '../../notifications/index.js';
import { systemSnapshot } from './SystemSnapshot.js';

import type { AdminSystemDto } from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';
import type { PeriodQueryDto } from '../dto/in/index.js';

/**
 * Ajustes › Sistema (`0071`). Whether mail and push are set up is asked of the
 * services that decide it, so the console can never disagree with what the
 * service really does.
 */
@Injectable()
export class AdminSystemService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly email: EmailService,
    private readonly push: PushService
  ) {}

  async system(query: PeriodQueryDto): Promise<AdminSystemDto> {
    return AdminSystemController.system(query.period, systemSnapshot(this.env, { mail: this.email.configured, push: this.push.configured }));
  }
}
