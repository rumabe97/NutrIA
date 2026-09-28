import type { AdminIngredientsView, AdminRecipesView } from 'core/controllers/Admin';

/** One page of recipes and the catalogue's counts. What each dish is; nobody who made it (`0028`). */
export type AdminRecipesDto = AdminRecipesView;

/** One page of ingredients, per 100 g. */
export type AdminIngredientsDto = AdminIngredientsView;
