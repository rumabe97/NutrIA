import type { AdminCatalogueQualityView, AdminIngredientsView, AdminRecipesView, PictureRetryView } from 'core/controllers/Admin';

/** One page of recipes and the catalogue's counts. What each dish is; nobody who made it (`0028`). */
export type AdminRecipesDto = AdminRecipesView;

/** One page of ingredients, per 100 g. */
export type AdminIngredientsDto = AdminIngredientsView;

/** Catálogo › Calidad: the catalogue's defects and the rewrite sweep's state (`0071`). Counts; the catalogue names nobody. */
export type AdminCatalogueQualityDto = AdminCatalogueQualityView;

/** The owner's retry of a dish's picture: it is being drawn. */
export type PictureRetryDto = PictureRetryView;
