import { Module } from '@nestjs/common';

import { VacationsController } from './controllers/index.js';
import { VacationsService } from './services/index.js';

@Module({ controllers: [VacationsController], providers: [VacationsService] })
export class VacationsModule {}
