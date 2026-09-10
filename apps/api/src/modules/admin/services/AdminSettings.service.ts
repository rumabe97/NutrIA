import { Injectable } from '@nestjs/common';

import { SettingsController } from 'core/controllers/Settings';

import type { SetFlagDto } from '../dto/in/index.js';
import type { AdminSettingsViewDto } from '../dto/out/index.js';

@Injectable()
export class AdminSettingsService {
  /** `'owner'`, so the answer carries the operational switches a signed-in reader is not shown. */
  async read(): Promise<AdminSettingsViewDto> {
    return SettingsController.read('owner');
  }

  async setFlag(body: SetFlagDto): Promise<AdminSettingsViewDto> {
    return SettingsController.setFlag(body.flag, body.enabled);
  }
}
