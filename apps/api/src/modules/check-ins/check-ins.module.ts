import { Module } from '@nestjs/common';

import { CheckInsController } from './controllers/index.js';
import { CheckInsService } from './services/index.js';

@Module({ controllers: [CheckInsController], providers: [CheckInsService] })
export class CheckInsModule {}
