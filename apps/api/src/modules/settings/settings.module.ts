import { Module } from '@nestjs/common';

import { SettingsController } from './controllers/index.js';
import { SettingsService } from './services/index.js';

@Module({ controllers: [SettingsController], providers: [SettingsService] })
export class SettingsModule {}
