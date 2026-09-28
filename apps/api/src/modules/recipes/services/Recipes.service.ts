import { Injectable } from '@nestjs/common';

import { RecipeController } from 'core/controllers/Recipe';

import type { PictureStatusDto, VerdictDto } from '../dto/out/index.js';
import type { SetRecipeVerdictDto } from '../dto/in/index.js';

@Injectable()
export class RecipesService {
  /** Scoped to the session's user: a dish they were never served is a 404. */
  async pictureStatus(userId: string, recipeId: string): Promise<PictureStatusDto> {
    return RecipeController.pictureStatus(userId, recipeId);
  }

  /**
   * The verdict belongs to the session's user; the recipe id is the only thing
   * the client names, and a recipe that does not exist is a 404 like any denial.
   */
  async setVerdict(userId: string, recipeId: string, body: SetRecipeVerdictDto): Promise<VerdictDto> {
    await RecipeController.setVerdict(userId, recipeId, body.verdict);

    return body;
  }
}
