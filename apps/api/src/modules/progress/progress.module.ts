import { Module } from '@nestjs/common';

import { ProgressRestController } from './progress.controller.js';

@Module({ controllers: [ProgressRestController] })
export class ProgressModule {}
