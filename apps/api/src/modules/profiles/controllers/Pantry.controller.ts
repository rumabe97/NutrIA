import { Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AddPantryItemDto } from '../dto/in/index.js';
import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { PantryService } from '../services/index.js';

import type { PantryDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * What is already in the house, typed before a fortnight is asked for.
 *
 * The user id is taken from `@CurrentUser()` on every route and passed as the
 * first argument to the service; **no route accepts a user id**, and the entry
 * id in the URL is checked against the session rather than trusted, so an id
 * that is not the caller's answers the same 404 as one that does not exist.
 *
 * **No `@RequiresOnboarding()`**, unlike the fixed meals: resolving a cupboard
 * word needs the catalogue and nothing about the person, so the answer exists
 * before a profile does. The generation that spends the draft carries the
 * guard, where it belongs.
 *
 * Every route answers the whole cupboard, including the bound, so a screen can
 * say the limit before anybody meets it.
 */
@ApiTags('pantry')
@Controller('pantry')
export class PantryController {
  constructor(private readonly pantry: PantryService) {}

  @ApiCreatedResponse({
    description:
      'The cupboard as it now stands. An entry the catalogue has no answer for is kept with `slug: null`. Naming something already there writes the amount over the old one. 422 naming `label` when the cupboard is full — the same bound on both tiers.'
  })
  @ApiOperation({ summary: 'Say that something is already in the house' })
  @Post()
  async add(@CurrentUser() user: SessionUser, @ZodBody(AddPantryItemDto) body: AddPantryItemDto): Promise<PantryDto> {
    return this.pantry.add(user.id, body);
  }

  @ApiOkResponse({ description: 'Emptied. Answers the empty cupboard, and says so for one that was already empty.' })
  @ApiOperation({ summary: 'Empty the cupboard' })
  @Delete()
  async clear(@CurrentUser() user: SessionUser): Promise<PantryDto> {
    return this.pantry.clear(user.id);
  }

  @ApiOkResponse({ description: 'What this account says is in the house, in the order it was said, and how many things it may name.' })
  @ApiOperation({ summary: 'The cupboard as it now stands' })
  @Get()
  async read(@CurrentUser() user: SessionUser): Promise<PantryDto> {
    return this.pantry.read(user.id);
  }

  @ApiOkResponse({
    description: 'The cupboard without it. 404 for an id this account does not own, byte for byte the answer for one that does not exist.'
  })
  @ApiOperation({ summary: 'Take one thing out of the cupboard' })
  @Delete(':id')
  async remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<PantryDto> {
    return this.pantry.remove(user.id, id);
  }
}
