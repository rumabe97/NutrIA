import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlanController } from 'core/controllers/Plan';
import { setShoppingItemSchema } from 'core/entities/Plan';

import { CurrentUser, Locale } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { SessionUser } from '../../shared/decorators/index.js';
import type { SetShoppingItem } from 'core/entities/Plan';

/**
 * Reading the active plan's list, and ticking items off it.
 *
 * Ticking is all that is writable, and deliberately so: editing quantities and
 * adding rows change what the list *says the plan needs*, which is a different
 * claim and needs its own thinking. A checkbox only records what the shopper has
 * already picked up.
 */
@ApiTags('shopping-lists')
@Controller('shopping-lists')
export class ShoppingListsController {
  @ApiOperation({ summary: "The shopping list for the active plan. 404 when there is no active plan." })
  @Get('active')
  async active(@CurrentUser() user: SessionUser, @Locale() locale: string | null) {
    const plan = await PlanController.getActivePlan(user.id, locale);

    if (!plan) {throw new NotFoundException();}

    return PlanController.getShoppingList(user.id, plan.id, locale);
  }

  @ApiOperation({ summary: 'Tick an item off, or put it back. An item on another account\u2019s list is not found.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('items/:id')
  async setChecked(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setShoppingItemSchema)) body: SetShoppingItem
  ): Promise<void> {
    await PlanController.setShoppingItemChecked(user.id, id, body.checked);
  }
}
