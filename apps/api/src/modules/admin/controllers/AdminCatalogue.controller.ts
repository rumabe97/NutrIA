import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  DEFAULT_PAGE_SIZE,
  INGREDIENT_SORTS,
  MAX_PAGE_SIZE,
  RECIPE_CHECKS,
  RECIPE_SORTS,
  RECIPE_SOURCES,
  SORT_DIRECTIONS
} from 'core/entities/AdminQuery';
import { INGREDIENT_CATEGORIES, MEAL_SLOTS } from 'core/entities/Plan';

import { AdminCatalogueService } from '../services/index.js';
import { IngredientCatalogueQueryDto, PeriodQueryDto, RecipeCatalogueQueryDto } from '../dto/in/index.js';
import { CurrentUser, RateLimit, Roles } from '../../../shared/index.js';
import { PERIOD_PARAMETER, ZodQuery } from './ZodQuery.js';

import type { AdminCatalogueQualityDto, AdminIngredientsDto, AdminRecipesDto, PictureRetryDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

const PAGE_SIZE = { description: `1–${MAX_PAGE_SIZE}. ${DEFAULT_PAGE_SIZE} when absent.`, name: 'size', required: false, type: Number } as const;

/**
 * The shared catalogue, read only (`0068`): recipes and ingredients are
 * reference data and name nobody — no `created_by`, no id of a person
 * (`0028`). Editing it stays in the seed file in git.
 */
@ApiTags('admin')
@Controller('admin/catalogue')
@Roles('admin')
export class AdminCatalogueController {
  constructor(private readonly catalogue: AdminCatalogueService) {}

  @ApiOkResponse({
    description:
      'One page of recipes with macros per serving (the app’s own composition), allergens, picture state (with the reason it failed or was given back, and when its cool-off ends) and source, and the catalogue’s counts by slot and source and without a ready picture. 422 INVALID_INPUT for an unknown filter or sort.'
  })
  @ApiOperation({ summary: 'Search, filter, sort and page the recipes (0068)' })
  @ApiQuery({ description: 'Name contains, case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ enum: MEAL_SLOTS, name: 'slot', required: false })
  @ApiQuery({ description: 'An allergen key a served ingredient contains, e.g. `gluten`.', name: 'allergen', required: false, type: String })
  @ApiQuery({ enum: ['ready', 'drawing', 'failed', 'none'], name: 'picture', required: false })
  @ApiQuery({
    description:
      'Only the recipes a quality check finds — the ones Catálogo › Calidad counts (0071): `over_bound`, `uncosted`, `unserved`, `refusal_limit`, `over_cap`.',
    enum: RECIPE_CHECKS,
    name: 'check',
    required: false
  })
  @ApiQuery({ enum: RECIPE_SOURCES, name: 'source', required: false })
  @ApiQuery({ description: 'BCP 47, e.g. `es-ES`.', name: 'locale', required: false, type: String })
  @ApiQuery({ enum: RECIPE_SORTS, name: 'sort', required: false })
  @ApiQuery({ enum: SORT_DIRECTIONS, name: 'dir', required: false })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery(PAGE_SIZE)
  @Get('recipes')
  async recipes(@ZodQuery(RecipeCatalogueQueryDto) query: RecipeCatalogueQueryDto): Promise<AdminRecipesDto> {
    return this.catalogue.recipes(query);
  }

  @ApiAcceptedResponse({
    description: 'The picture was claimed and is being drawn: `{ status: "drawing" }`. One `picture.retried` row is in the trail.'
  })
  @ApiConflictResponse({
    description:
      '`PICTURE_FLAG_OFF` (the dishPictures switch is off), `PICTURE_UNAVAILABLE` (no image, judge or store configured), `PICTURE_CAP_REACHED` (this month’s cap), `PICTURE_DRAWING` (already being drawn) or `PICTURE_NOT_RETRYABLE` (the picture is ready, or was never drawn).'
  })
  @ApiNotFoundResponse({ description: 'No such recipe.' })
  @ApiOperation({ summary: 'Retry a failed or given-back dish picture by hand, ignoring the cool-off (0066)' })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('recipes/:id/picture/retry')
  @RateLimit({ limit: 30, ttlSeconds: 3600 })
  async retryPicture(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<PictureRetryDto> {
    return this.catalogue.retryPicture(id, owner.id);
  }

  @ApiOkResponse({
    description:
      'What should be zero (recipes past the bound, without costable macros, meals with servings outside the bounds, dishes never served, recipes at the sweep’s refusal limit), what is worth a look (recipes over their meal’s cap by source, `oversized` rejections per day, pictures failed) and the rewrite sweep’s state. Counts only. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: 'Catalogue quality and the rewrite sweep (0071)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('quality')
  async quality(@ZodQuery(PeriodQueryDto) query: PeriodQueryDto): Promise<AdminCatalogueQualityDto> {
    return this.catalogue.quality(query);
  }

  @ApiOkResponse({
    description: 'One page of ingredients per 100 g, with allergens, countries and meal slots. 422 INVALID_INPUT for an unknown filter or sort.'
  })
  @ApiOperation({ summary: 'Search, filter, sort and page the ingredients (0068)' })
  @ApiQuery({ description: 'Name in any language, or slug, contains; case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ enum: INGREDIENT_CATEGORIES, name: 'category', required: false })
  @ApiQuery({ description: 'An allergen key the ingredient contains, e.g. `milk`.', name: 'allergen', required: false, type: String })
  @ApiQuery({ enum: INGREDIENT_SORTS, name: 'sort', required: false })
  @ApiQuery({ enum: SORT_DIRECTIONS, name: 'dir', required: false })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery(PAGE_SIZE)
  @Get('ingredients')
  async ingredients(@ZodQuery(IngredientCatalogueQueryDto) query: IngredientCatalogueQueryDto): Promise<AdminIngredientsDto> {
    return this.catalogue.ingredients(query);
  }
}
