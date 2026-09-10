import { Injectable } from '@nestjs/common';

import { SettingsController } from 'core/controllers/Settings';

import type { SettingsDto } from '../dto/out/index.js';

@Injectable()
export class SettingsService {
  async read(): Promise<SettingsDto> {
    return SettingsController.read();
  }
}
