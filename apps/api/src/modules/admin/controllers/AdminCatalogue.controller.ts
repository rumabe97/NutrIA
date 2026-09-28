import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DEFAULT_PAGE_SIZE, INGREDIENT_SORTS, MAX_PAGE_SIZE, RECIPE_SORTS, RECIPE_SOURCES, SORT_DIRECTIONS } from 'core/entities/AdminQuery';
import { INGREDIENT_CATEGORIES, MEAL_SLOTS } from 'core/entities/Plan';

import { AdminCatalogueService } from '../services/index.js';
import { IngredientCatalogueQueryDto, RecipeCatalogueQueryDto } from '../dto/in/index.js';
import { Roles } from '../../../shared/index.js';
import { ZodQuery } from './ZodQuery.js';

import type { AdminIngredientsDto, AdminRecipesDto } from '../dto/out/index.js';

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
      'One page of recipes with macros per serving (the app’s own composition), allergens, picture state and source, and the catalogue’s counts by slot and source and without a ready picture. 422 INVALID_INPUT for an unknown filter or sort.'
  })
  @ApiOperation({ summary: 'Search, filter, sort and page the recipes (0068)' })
  @ApiQuery({ description: 'Name contains, case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ enum: MEAL_SLOTS, name: 'slot', required: false })
  @ApiQuery({ description: 'An allergen key a served ingredient contains, e.g. `gluten`.', name: 'allergen', required: false, type: String })
  @ApiQuery({ enum: ['ready', 'drawing', 'failed', 'none'], name: 'picture', required: false })
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
