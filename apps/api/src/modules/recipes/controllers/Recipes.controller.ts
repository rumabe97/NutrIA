import { Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequiresOnboarding, ZodBody } from '../../../shared/index.js';
import { RecipesService } from '../services/index.js';
import { SetRecipeVerdictDto } from '../dto/in/index.js';

import type { SessionUser } from '../../../shared/index.js';
import type { PictureStatusDto, VerdictDto } from '../dto/out/index.js';

@ApiTags('recipes')
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  /**
   * What the meal page polls while its dish says `drawing` (`0066`). The same
   * door as the meal detail — a session — and only for a dish on one of the
   * caller's own plans; any other is a 404. It reads and never starts a
   * drawing: only opening the meal does. Not cached, like every answer here.
   */
  @ApiOkResponse({ description: '`{ status, url }`: `ready` with the public address, `drawing`, or `none`.' })
  @ApiOperation({ summary: "Where a dish's picture stands — for the meal page to poll while it is being drawn" })
  @Get(':id/picture-status')
  @RequiresOnboarding()
  async pictureStatus(@CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<PictureStatusDto> {
    return this.recipes.pictureStatus(user.id, id);
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
