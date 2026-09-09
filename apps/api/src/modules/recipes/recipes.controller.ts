import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Put, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RecipeController } from 'core/controllers/Recipe';
import { setRecipeVerdictSchema } from 'core/entities/Plan';

import { CurrentUser, Public } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { Response } from 'express';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { SetRecipeVerdict } from 'core/entities/Plan';

/**
 * Public, and the only public route that serves stored bytes.
 *
 * A picture of grilled squid is not anyone's data, and being public is what lets
 * the edge and the phone cache it: the response is immutable — a redrawn recipe
 * gets the same path, which is the one thing this trades away, deliberately,
 * for a year of caching. Nothing but the bytes travels; no recipe field does.
 */
@ApiTags('recipes')
@Controller('recipes')
export class RecipesController {
  @ApiOperation({ summary: "A recipe's illustration" })
  @Get(':id/image')
  @Public()
  async image(@Param('id', new ParseUUIDPipe()) id: string, @Res() response: Response): Promise<void> {
    const image = await RecipeController.illustration(id);

    if (!image) {throw new NotFoundException();}

    response.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    response.setHeader('Content-Type', image.contentType);
    response.end(image.bytes);
  }

  @ApiOperation({ summary: 'Say whether this dish should come back — it shapes the next plan' })
  @Put(':id/verdict')
  async verdict(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(setRecipeVerdictSchema)) body: SetRecipeVerdict
  ): Promise<SetRecipeVerdict> {
    // The verdict belongs to the session's user; the recipe id is the only thing
    // the client names, and a recipe that does not exist is a 404 like any denial.
    await RecipeController.setVerdict(user.id, id, body.verdict);

    return body;
  }
}
