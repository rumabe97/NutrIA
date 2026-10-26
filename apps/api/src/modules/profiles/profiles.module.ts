import { Module } from '@nestjs/common';

import { PantryController, ProfilesController } from './controllers/index.js';
import { PantryService, ProfilesService } from './services/index.js';

@Module({ controllers: [PantryController, ProfilesController], providers: [PantryService, ProfilesService] })
export class ProfilesModule {}
