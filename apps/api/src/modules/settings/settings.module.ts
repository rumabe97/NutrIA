import { Module } from '@nestjs/common';

import { SettingsRestController } from './settings.controller.js';

@Module({ controllers: [SettingsRestController] })
export class SettingsModule {}
