import { Module } from '@nestjs/common';

import { ProfilesController } from './controllers/index.js';
import { ProfilesService } from './services/index.js';

@Module({ controllers: [ProfilesController], providers: [ProfilesService] })
export class ProfilesModule {}
