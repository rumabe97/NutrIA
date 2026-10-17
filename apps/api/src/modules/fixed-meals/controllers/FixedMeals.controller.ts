import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AddFixedMealDto, DishConsequenceDto, RequestDishDto, SearchDishDto } from '../dto/in/index.js';
import { CurrentUser, RateLimit, RequiresOnboarding, ZodBody } from '../../../shared/index.js';
import { FixedMealsService } from '../services/index.js';
import { InputParseError } from 'core/entities/Error';
import { weekdaySchema } from 'core/entities/FixedMeal';
import { MEAL_SLOTS } from 'core/entities/Plan';

import type {
  FixableDishDto,
  FixedMealConsequenceDto,
  FixedMealDto,
  FixedMealHonourabilityDto,
  FixedMealsDto,
  NotOfferedDishDto
} from '../dto/out/index.js';
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
      'The rule. 422 when the dish cannot be fixed to that meal at all, with the reason in `fieldErrors.dishSlug`; 409 FIXED_MEAL_WARNING with `warning` when the day’s arithmetic says no and the body did not accept it (`0103`); 409 FIXED_MEAL_DAY_FULL with `dayLimit` when that weekday already holds its two (`0103`); 409 when that **meal** of that weekday already has one (`0101`); 429 QUOTA_EXCEEDED when the tier’s fixed meals are all used.'
  })
  @ApiOperation({ summary: 'Fix a dish to one meal of one weekday, in every plan from now on' })
  @Post()
  async add(@CurrentUser() user: SessionUser, @ZodBody(AddFixedMealDto) body: AddFixedMealDto): Promise<FixedMealDto> {
    const { accept, ...rule } = body;

    return this.fixedMeals.add(user.id, rule, accept);
  }

  @ApiOkResponse({
    description:
      'Whether that dish can be fixed there, and what it would cost: `fixable`, or a reason with `acceptable` saying whether the person may fix it anyway (`0103`). 409 FIXED_MEAL_DAY_FULL when that weekday already holds its two, which is not a fact about the dish.'
  })
  @ApiOperation({ summary: 'What fixing this dish to this meal would cost, before anybody commits' })
  // A read, and a POST for `SearchDishDto`'s reason: the dish somebody is about
  // to fix for their Tuesday dinner must not land in the platform's access log,
  // which keys on the query string and is not ours to redact. 200, since nothing
  // is created.
  @HttpCode(HttpStatus.OK)
  // One assembly of this person's library, as `not-offered` is, and the screen
  // asks it once per dish somebody actually touches.
  @RateLimit({ limit: 60, ttlSeconds: 3600 })
  @Post('consequence')
  async consequence(@CurrentUser() user: SessionUser, @ZodBody(DishConsequenceDto) body: DishConsequenceDto): Promise<FixedMealConsequenceDto> {
    return this.fixedMeals.consequence(user.id, body.weekday, body.slot, body.dishSlug);
  }

  @ApiOkResponse({
    description:
      'The dishes that can be fixed there, by name — the plate fit, judged against the plan this person would generate next. Empty when that weekday already holds its two rules (`0103`).'
  })
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

  @ApiOkResponse({
    description:
      'Which of this account’s standing rules the plan it would generate next cannot honour, each with the reason. `judged: false` means the answer could not be computed, not that every rule is fine.'
  })
  @ApiOperation({ summary: 'Which standing fixed meals are not being honoured, and why' })
  // Its own request because it costs its own generation context (75–90 ms
  // measured against the local library, beside 2 ms for the rules themselves),
  // and the rules screen must open no slower than it did. The screen asks for it
  // once the rules are on it.
  @Get('honourability')
  // One assembly of this person's whole library per call. A screen opening asks
  // once; this is the bound on anything else.
  @RateLimit({ limit: 60, ttlSeconds: 3600 })
  async honourability(@CurrentUser() user: SessionUser): Promise<FixedMealHonourabilityDto> {
    return this.fixedMeals.honourability(user.id);
  }

  @ApiOkResponse({
    description: 'Dishes the library has that match the search and are not offered, each with the reason and whether the person can act on it.'
  })
  @ApiOperation({ summary: 'Why a dish somebody searched for is not offered for that meal' })
  // A read, and still a POST: what somebody typed travels in the body, because a
  // query string reaches the platform's access log, which is not ours to redact
  // (`SearchDishDto`). It answers 200 rather than 201 for the same reason it is
  // a POST — nothing is created.
  @HttpCode(HttpStatus.OK)
  // It assembles this person's whole library twice and fires on every pause in
  // typing, with only the screen's own debounce in front of it. Generous for a
  // person who is searching, a bound for anything else.
  @RateLimit({ limit: 60, ttlSeconds: 3600 })
  @Post('not-offered')
  async notOffered(@CurrentUser() user: SessionUser, @ZodBody(SearchDishDto) body: SearchDishDto): Promise<readonly NotOfferedDishDto[]> {
    return this.fixedMeals.notOffered(user.id, body.weekday, body.slot, body.query);
  }

  @ApiCreatedResponse({
    description:
      'The dish, written and stored, ready to fix. 422 when what was typed is not a dish name, 409 when nothing we could serve came back, 429 QUOTA_EXCEEDED when the month’s requests are spent.'
  })
  @ApiOperation({ summary: 'Ask us to write a dish the library does not have. Spends an allowance only when a dish is stored.' })
  // A model call per request, and **a refused request spends no allowance** —
  // which is the promise, and also means a deliberate loop of refusals is
  // unbounded by the allowance. This is what bounds it: four an hour against
  // three dishes a month is room for a retry and a change of mind, and it is the
  // only ceiling on calls there is. A ceiling on *calls* per month would need a
  // row per request, which is the one thing this feature does not keep
  // (`invariant-reviewer`, 2026-10-13; the trade is the owner's).
  @RateLimit({ limit: 4, ttlSeconds: 3600 })
  @Post('request')
  async request(@CurrentUser() user: SessionUser, @ZodBody(RequestDishDto) body: RequestDishDto): Promise<FixableDishDto> {
    return this.fixedMeals.request(user.id, body.weekday, body.slot, body.name);
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
