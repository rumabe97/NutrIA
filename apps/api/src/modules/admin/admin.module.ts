import { Module } from '@nestjs/common';

import { AdminRestController } from './admin.controller.js';
import { envProvider } from '../../config/index.js';

@Module({ controllers: [AdminRestController], providers: [envProvider] })
export class AdminModule {}
