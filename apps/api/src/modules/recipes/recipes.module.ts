import { Module } from '@nestjs/common';

import { envProvider } from '../../config/index.js';
import { IllustrateController } from './illustrate.controller.js';
import { RecipesController } from './recipes.controller.js';

@Module({ controllers: [IllustrateController, RecipesController], providers: [envProvider] })
export class RecipesModule {}
