import { Injectable } from '@nestjs/common';

import { AdminCatalogueController, AdminQualityController } from 'core/controllers/Admin';

import { STEPS_VERSION } from '../../ai/prompts/PoolPrompt.js';

import type { AdminCatalogueQualityDto, AdminIngredientsDto, AdminRecipesDto } from '../dto/out/index.js';
import type { IngredientCatalogueQueryDto, PeriodQueryDto, RecipeCatalogueQueryDto } from '../dto/in/index.js';

/** The catalogue's two tables. The queries arrive validated; the rules — and the macros — are `packages/core`'s. */
@Injectable()
export class AdminCatalogueService {
  async ingredients(query: IngredientCatalogueQueryDto): Promise<AdminIngredientsDto> {
    return AdminCatalogueController.ingredients(query);
  }

  /** The current steps version is the API's: `check=refusal_limit` is read against it. */
  async quality(query: PeriodQueryDto): Promise<AdminCatalogueQualityDto> {
    return AdminQualityController.quality(query.period, STEPS_VERSION);
  }

  async recipes(query: RecipeCatalogueQueryDto): Promise<AdminRecipesDto> {
    return AdminCatalogueController.recipes(query, STEPS_VERSION);
  }
}
