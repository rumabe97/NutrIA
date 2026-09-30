import type {
  AdminCatalogueQualityView,
  AdminIngredientsView,
  AdminRecipesView,
  AdminRecipeView,
  PictureDiscardView,
  PictureRetryView
} from 'core/controllers/Admin';
import type { StreamableFile } from '@nestjs/common';

/** One page of recipes and the catalogue's counts. What each dish is; nobody who made it (`0028`). */
export type AdminRecipesDto = AdminRecipesView;

/** One recipe: the table's row and its served ingredients. A dish; nobody who made it (`0028`). */
export type AdminRecipeDto = AdminRecipeView;

/** One page of ingredients, per 100 g. */
export type AdminIngredientsDto = AdminIngredientsView;

/** Catálogo › Calidad: the catalogue's defects and the rewrite sweep's state (`0071`). Counts; the catalogue names nobody. */
export type AdminCatalogueQualityDto = AdminCatalogueQualityView;

/**
 * A candidate's file (`0072`): the JPEG itself, byte for byte as the model returned it — the API's
 * one answer that is not JSON. `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff`,
 * `Cache-Control: private, no-store`. It is the only way the file is read: no answer carries its address.
 */
export type PictureCandidateFileDto = StreamableFile;

/** The owner's discard of a candidate: its file and its pointer are gone, and the dish waits as before. */
export type PictureDiscardDto = PictureDiscardView;

/** The owner's retry of a dish's picture: it is being drawn. */
export type PictureRetryDto = PictureRetryView;
