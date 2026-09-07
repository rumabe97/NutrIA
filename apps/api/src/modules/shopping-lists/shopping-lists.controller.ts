import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlanController } from 'core/controllers/Plan';

import { CurrentUser } from '../../shared/decorators/index.js';

import type { SessionUser } from '../../shared/decorators/index.js';

/**
 * Read-only for this project. Checking items off, editing quantities and adding
 * rows arrive in project 004 — the list is generated and stored now, so the data
 * is real, but nothing here pretends to be interactive.
 */
@ApiTags('shopping-lists')
@Controller('shopping-lists')
export class ShoppingListsController {
  @ApiOperation({ summary: "The shopping list for the active plan. 404 when there is no active plan." })
  @Get('active')
  async active(@CurrentUser() user: SessionUser) {
    const plan = await PlanController.getActivePlan(user.id);

    if (!plan) {throw new NotFoundException();}

    return PlanController.getShoppingList(user.id, plan.id);
  }
}
