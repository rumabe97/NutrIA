import type {
  AdminCatalogueQualityView,
  AdminCupboardUncookedView,
  AdminCupboardUnresolvedView,
  AdminIngredientsView,
  AdminRecipesView,
  AdminRecipeView,
  PictureAcceptView,
  PictureDiscardView,
  PictureRemoveView,
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

/** The owner's acceptance of a candidate against the judge (`0072`): it is the dish's picture now. */
export type PictureAcceptDto = PictureAcceptView;

/** The owner's removal of a published picture, the judge's or one accepted by hand: the dish has none again, and whether its public file was deleted. */
export type PictureRemoveDto = PictureRemoveView;

/** The owner's discard of a candidate: its file and its pointer are gone, and the dish waits as before. */
export type PictureDiscardDto = PictureDiscardView;

/** The owner's retry of a dish's picture: it is being drawn. */
export type PictureRetryDto = PictureRetryView;

/** Words nobody could resolve, held by two accounts or more, as counts of accounts. A snapshot of what is held now; never an account, never a word as typed (P2-6, `0028`). */
export type AdminCupboardUnresolvedDto = AdminCupboardUnresolvedView;

/** Catalogue ingredients no recipe uses, with how many accounts hold each. A snapshot; reference data plus an aggregate (`0028`). */
export type AdminCupboardUncookedDto = AdminCupboardUncookedView;
