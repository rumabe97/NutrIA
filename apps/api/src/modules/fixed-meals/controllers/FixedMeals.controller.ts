import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AddFixedMealDto } from '../dto/in/index.js';
import { CurrentUser, RequiresOnboarding, ZodBody } from '../../../shared/index.js';
import { FixedMealsService } from '../services/index.js';
import { InputParseError } from 'core/entities/Error';
import { weekdaySchema } from 'core/entities/FixedMeal';
import { MEAL_SLOTS } from 'core/entities/Plan';

import type { FixableDishDto, FixedMealDto, FixedMealsDto } from '../dto/out/index.js';
import type { MealSlot } from 'core/entities/Plan';
import type { SessionUser } from '../../../shared/index.js';

/**
 * A meal fixed to one day of the week, for ever (`0098`, `0099`). Every route is
 * scoped to the caller's own session, and the id in the URL is checked against
 * it rather than trusted.
 *
 * Behind `@RequiresOnboarding()`, unlike events: fixing a dish means being
 * offered the dishes this person can be served, and that answer does not exist
 * until there is a profile to filter by.
 */
@ApiTags('fixed-meals')
@Controller('fixed-meals')
@RequiresOnboarding()
export class FixedMealsController {
  constructor(private readonly fixedMeals: FixedMealsService) {}

  @ApiCreatedResponse({
    description:
      'The rule. 422 when the dish cannot be fixed to that meal, 409 when that weekday already has one, 429 QUOTA_EXCEEDED when the tier’s fixed meals are all used.'
  })
  @ApiOperation({ summary: 'Fix a dish to one meal of one weekday, in every plan from now on' })
  @Post()
  async add(@CurrentUser() user: SessionUser, @ZodBody(AddFixedMealDto) body: AddFixedMealDto): Promise<FixedMealDto> {
    return this.fixedMeals.add(user.id, body);
  }

  @ApiOkResponse({ description: 'The dishes that can be fixed there, by name. Judged against the plan this person would generate next.' })
  @ApiOperation({ summary: 'Which dishes can be fixed to one meal of one weekday' })
  @ApiQuery({ enum: MEAL_SLOTS, name: 'slot' })
  @ApiQuery({ description: '0-6, Monday first', name: 'weekday', type: Number })
  @Get('fixable')
  async fixable(
    @CurrentUser() user: SessionUser,
    @Query('weekday') weekday: string,
    @Query('slot') slot: string
  ): Promise<readonly FixableDishDto[]> {
    return this.fixedMeals.fixable(user.id, weekdaySchema.parse(Number(weekday)), parsedSlot(slot));
  }

  @ApiNoContentResponse({ description: 'Removed. Plans already built with it keep the dish they were built with.' })
  @ApiOperation({ summary: 'Remove a fixed meal' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.fixedMeals.remove(user.id, id);
  }

  @ApiOkResponse({ description: 'The rules this account has, and how many more it may have.' })
  @ApiOperation({ summary: 'The meals fixed to a weekday, and what is left of the allowance' })
  @Get()
  async standing(@CurrentUser() user: SessionUser): Promise<FixedMealsDto> {
    return this.fixedMeals.standing(user.id);
  }
}

/** A query string is text; the slot has to be one of the six before it reaches the domain. */
function parsedSlot(slot: string): MealSlot {
  const known = MEAL_SLOTS.find(candidate => candidate === slot);

  if (!known) {
    throw new InputParseError('That is not a meal', { slot: [`must be one of ${MEAL_SLOTS.join(', ')}`] });
  }

  return known;
}
