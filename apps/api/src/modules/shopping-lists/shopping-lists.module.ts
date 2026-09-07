import { Module } from '@nestjs/common';

import { ShoppingListsController } from './shopping-lists.controller.js';

@Module({ controllers: [ShoppingListsController] })
export class ShoppingListsModule {}
