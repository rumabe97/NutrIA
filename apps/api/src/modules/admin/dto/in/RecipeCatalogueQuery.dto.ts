import { recipeCatalogueQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The recipe table's query string (`0068`): name search, slot, allergen, picture, source, locale, sort, page. */
export const RecipeCatalogueQueryDto = zodDto('RecipeCatalogueQuery', recipeCatalogueQuerySchema);
export type RecipeCatalogueQueryDto = InferDto<typeof RecipeCatalogueQueryDto>;
