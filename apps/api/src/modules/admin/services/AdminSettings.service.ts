import { Injectable } from '@nestjs/common';

import { SettingsController } from 'core/controllers/Settings';

import type { AdminSettingsDto } from '../dto/in/index.js';
import type { AdminSettingsViewDto } from '../dto/out/index.js';

@Injectable()
export class AdminSettingsService {
  async read(): Promise<AdminSettingsViewDto> {
    return SettingsController.read();
  }

  async setAutomaticActivation(body: AdminSettingsDto): Promise<AdminSettingsViewDto> {
    return SettingsController.setAutomaticActivation(body.automaticActivation);
  }
}
