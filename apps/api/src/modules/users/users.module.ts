import { Module } from '@nestjs/common';

import { UsersController } from './controllers/index.js';
import { UsersService } from './services/index.js';

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
