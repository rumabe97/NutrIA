import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RecipeController } from 'core/controllers/Recipe';

import { Public } from '../../shared/decorators/index.js';

import type { Response } from 'express';

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
}
