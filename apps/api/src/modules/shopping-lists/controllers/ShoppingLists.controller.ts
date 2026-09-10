import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Locale, ZodBody } from '../../../shared/index.js';
import { SetShoppingItemDto } from '../dto/in/index.js';
import { ShoppingListsService } from '../services/index.js';

import type { SessionUser } from '../../../shared/index.js';
import type { ShoppingListDto } from '../dto/out/index.js';

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
  constructor(private readonly lists: ShoppingListsService) {}

  @ApiOkResponse({ description: 'The list for the active plan, in the reader’s language.' })
  @ApiOperation({ summary: 'The shopping list for the active plan. 404 when there is no active plan.' })
  @Get('active')
  async active(@CurrentUser() user: SessionUser, @Locale() locale: string | null): Promise<ShoppingListDto> {
    return this.lists.active(user.id, locale);
  }

  @ApiNoContentResponse({ description: 'Ticked, or put back.' })
  @ApiOperation({ summary: 'Tick an item off, or put it back. An item on another account’s list is not found.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('items/:id')
  async setChecked(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(SetShoppingItemDto) body: SetShoppingItemDto
  ): Promise<void> {
    await this.lists.setChecked(user.id, id, body);
  }
}
