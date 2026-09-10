import { Injectable } from '@nestjs/common';

import { RecipeController } from 'core/controllers/Recipe';

import type { RecipeImageDto, VerdictDto } from '../dto/out/index.js';
import type { SetRecipeVerdictDto } from '../dto/in/index.js';

@Injectable()
export class RecipesService {
  async illustration(recipeId: string): Promise<RecipeImageDto | undefined> {
    return RecipeController.illustration(recipeId);
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
