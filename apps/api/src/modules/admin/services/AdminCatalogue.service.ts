import { Injectable } from '@nestjs/common';

import { AdminCatalogueController, AdminQualityController } from 'core/controllers/Admin';
import { RecipeController } from 'core/controllers/Recipe';

import { DishPictureService, PictureCandidatesService } from '../../ai/services/index.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';
import { STEPS_VERSION } from '../../ai/prompts/PoolPrompt.js';

import type {
  AdminCatalogueQualityDto,
  AdminIngredientsDto,
  AdminRecipeDto,
  AdminRecipesDto,
  PictureDiscardDto,
  PictureRetryDto
} from '../dto/out/index.js';
import type { IngredientCatalogueQueryDto, PeriodQueryDto, RecipeCatalogueQueryDto } from '../dto/in/index.js';

/** The catalogue's two tables. The queries arrive validated; the rules — and the macros — are `packages/core`'s. */
@Injectable()
export class AdminCatalogueService {
  constructor(
    private readonly alerts: OwnerAlertsService,
    private readonly candidates: PictureCandidatesService,
    private readonly pictures: DishPictureService
  ) {}

  /**
   * The file of the rejected picture a dish holds for the owner (`0072`), as the model returned it.
   * A `NotFoundError` when there is none that can be looked at. The file is read by the API from
   * the private store: its path is never part of an answer.
   */
  async candidate(recipeId: string): Promise<Uint8Array> {
    return this.candidates.read(recipeId);
  }

  /**
   * The owner discards a dish's candidate: the file is deleted, then its pointer, with
   * `picture.discarded` in the pointer's transaction. The dish stays failed and keeps its cool-off —
   * discarding draws nothing and spends nothing; the retry is the verb that does.
   */
  async discardCandidate(recipeId: string, actorId: string): Promise<PictureDiscardDto> {
    await this.candidates.discard(recipeId, actorId);

    return { status: 'discarded' };
  }

  async ingredients(query: IngredientCatalogueQueryDto): Promise<AdminIngredientsDto> {
    return AdminCatalogueController.ingredients(query);
  }

  /** One recipe with its served ingredients, by the candidates' own clock like the table. The recipe is a dish: nothing here is scoped to a person. */
  async recipe(recipeId: string): Promise<AdminRecipeDto> {
    return AdminCatalogueController.recipe(recipeId, this.candidates.now());
  }

  /** The current steps version is the API's: `check=refusal_limit` is read against it. */
  async quality(query: PeriodQueryDto): Promise<AdminCatalogueQualityDto> {
    return AdminQualityController.quality(query.period, STEPS_VERSION);
  }

  /**
   * The owner's retry of a dish's picture: claimed with no cool-off (`RecipeController.retryPicture`,
   * which refuses and audits) and drawn exactly as a view's claim is — after the response, under the
   * same cap, flag and availability. The recipe is a dish, not a person: nothing here is scoped to one.
   * A retry that fails again is mailed like any other failed drawing (project 009).
   * A candidate the dish held is discarded by it: its file is deleted once the claim is made (`0072`).
   */
  async retryPicture(recipeId: string, actorId: string): Promise<PictureRetryDto> {
    const claim = await RecipeController.retryPicture(recipeId, actorId, {
      available: this.pictures.isAvailable,
      capUsd: this.pictures.capUsd,
      forget: path => this.candidates.forget(path)
    });

    this.pictures.schedule(claim, () => this.alerts.pictureFailures());

    return { status: 'drawing' };
  }

  async recipes(query: RecipeCatalogueQueryDto): Promise<AdminRecipesDto> {
    // The candidates' own clock, so a row and the file's route agree on what has expired.
    return AdminCatalogueController.recipes(query, STEPS_VERSION, this.candidates.now());
  }
}
