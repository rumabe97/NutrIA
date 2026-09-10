import { Module } from '@nestjs/common';

import { ProgressController } from './controllers/index.js';
import { ProgressService } from './services/index.js';

@Module({ controllers: [ProgressController], providers: [ProgressService] })
export class ProgressModule {}
