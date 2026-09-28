import { Injectable } from '@nestjs/common';

import { AdminCatalogueController } from 'core/controllers/Admin';

import type { AdminIngredientsDto, AdminRecipesDto } from '../dto/out/index.js';
import type { IngredientCatalogueQueryDto, RecipeCatalogueQueryDto } from '../dto/in/index.js';

/** The catalogue's two tables. The queries arrive validated; the rules — and the macros — are `packages/core`'s. */
@Injectable()
export class AdminCatalogueService {
  async ingredients(query: IngredientCatalogueQueryDto): Promise<AdminIngredientsDto> {
    return AdminCatalogueController.ingredients(query);
  }

  async recipes(query: RecipeCatalogueQueryDto): Promise<AdminRecipesDto> {
    return AdminCatalogueController.recipes(query);
  }
}
