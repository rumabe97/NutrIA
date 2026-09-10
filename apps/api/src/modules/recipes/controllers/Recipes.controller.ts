import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Put, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public, ZodBody } from '../../../shared/index.js';
import { RecipesService } from '../services/index.js';
import { SetRecipeVerdictDto } from '../dto/in/index.js';

import type { Response } from 'express';
import type { SessionUser } from '../../../shared/index.js';
import type { VerdictDto } from '../dto/out/index.js';

/** A year, because a redrawn recipe gets a new id and never the same path. */
const IMMUTABLE_FOR_A_YEAR = 'public, max-age=31536000, s-maxage=31536000, immutable';

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
  constructor(private readonly recipes: RecipesService) {}

  @ApiOkResponse({ description: 'The image bytes, immutable for a year.' })
  @ApiOperation({ summary: "A recipe's illustration" })
  @ApiProduces('image/webp')
  @Get(':id/image')
  @Public()
  async image(@Param('id', new ParseUUIDPipe()) id: string, @Res() response: Response): Promise<void> {
    const image = await this.recipes.illustration(id);

    if (!image) {throw new NotFoundException();}

    response.setHeader('Cache-Control', IMMUTABLE_FOR_A_YEAR);
    response.setHeader('Content-Type', image.contentType);
    response.end(image.bytes);
  }

  @ApiOkResponse({ description: 'The verdict as it now stands.' })
  @ApiOperation({ summary: 'Say whether this dish should come back — it shapes the next plan' })
  @Put(':id/verdict')
  async verdict(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ZodBody(SetRecipeVerdictDto) body: SetRecipeVerdictDto
  ): Promise<VerdictDto> {
    return this.recipes.setVerdict(user.id, id, body);
  }
}
