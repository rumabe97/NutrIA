import { ingredientCatalogueQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The ingredient table's query string (`0068`): name search, category, allergen, sort, page. */
export const IngredientCatalogueQueryDto = zodDto('IngredientCatalogueQuery', ingredientCatalogueQuerySchema);
export type IngredientCatalogueQueryDto = InferDto<typeof IngredientCatalogueQueryDto>;
