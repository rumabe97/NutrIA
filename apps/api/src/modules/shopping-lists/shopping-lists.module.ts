import { Module } from '@nestjs/common';

import { ShoppingListsController } from './controllers/index.js';
import { ShoppingListsService } from './services/index.js';

@Module({ controllers: [ShoppingListsController], providers: [ShoppingListsService] })
export class ShoppingListsModule {}
