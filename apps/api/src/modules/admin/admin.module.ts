import { Module } from '@nestjs/common';

import { AdminRestController } from './admin.controller.js';

@Module({ controllers: [AdminRestController] })
export class AdminModule {}
