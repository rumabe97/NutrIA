import { Module } from '@nestjs/common';

import { VacationsRestController } from './vacations.controller.js';

@Module({ controllers: [VacationsRestController] })
export class VacationsModule {}
