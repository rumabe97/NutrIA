import { Injectable } from '@nestjs/common';

import { AdminCatalogueController, AdminQualityController } from 'core/controllers/Admin';
import { RecipeController } from 'core/controllers/Recipe';

import { DishPictureService } from '../../ai/services/index.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';
import { STEPS_VERSION } from '../../ai/prompts/PoolPrompt.js';

import type { AdminCatalogueQualityDto, AdminIngredientsDto, AdminRecipesDto, PictureRetryDto } from '../dto/out/index.js';
import type { IngredientCatalogueQueryDto, PeriodQueryDto, RecipeCatalogueQueryDto } from '../dto/in/index.js';

/** The catalogue's two tables. The queries arrive validated; the rules — and the macros — are `packages/core`'s. */
@Injectable()
export class AdminCatalogueService {
  constructor(
    private readonly alerts: OwnerAlertsService,
    private readonly pictures: DishPictureService
  ) {}

  async ingredients(query: IngredientCatalogueQueryDto): Promise<AdminIngredientsDto> {
    return AdminCatalogueController.ingredients(query);
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
   */
  async retryPicture(recipeId: string, actorId: string): Promise<PictureRetryDto> {
    const claim = await RecipeController.retryPicture(recipeId, actorId, { available: this.pictures.isAvailable, capUsd: this.pictures.capUsd });

    this.pictures.schedule(claim, () => this.alerts.pictureFailures());

    return { status: 'drawing' };
  }

  async recipes(query: RecipeCatalogueQueryDto): Promise<AdminRecipesDto> {
    return AdminCatalogueController.recipes(query, STEPS_VERSION);
  }
}
