import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CareService } from '../services/index.js';
import { CurrentUser } from '../../../shared/index.js';

import type { CareLinkDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * A link that exists (`0059`): the client seeing it, and either side ending it.
 *
 * **No switch here, deliberately.** Consent is revocable (PRD 004, criterion
 * 4): a client sees what they agreed to and can take it back whatever the
 * `professional` switch says. The professional's side of ending is the one
 * part that needs the switch and the grant, and `CareController.end` asks
 * for both before it tries it. A client with no link gets the same answer
 * with the switch on or off — `null`, or a 404 for a link that is not theirs —
 * so leaving the switch off these routes tells nobody anything.
 *
 * No `ParseUUIDPipe` either: a path that is not a link id is the same 404 as
 * a link that is not the caller's, never a 400 that confirms the route.
 */
@ApiTags('care')
@Controller('care')
export class CareLinksController {
  constructor(private readonly care: CareService) {}

  @ApiOkResponse({ description: 'The account’s own active or paused link, or null.' })
  @ApiOperation({ summary: 'The signed-in client’s link to a professional, if any' })
  @Get('links/me')
  async myLink(@CurrentUser() user: SessionUser): Promise<CareLinkDto | null> {
    return this.care.myLink(user);
  }

  @ApiNoContentResponse({ description: 'Ended. 404 for a link the account is not on, one already ended, or anything that is not a link id.' })
  @ApiOperation({ summary: 'End a link, from either side' })
  @Delete('links/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async end(@CurrentUser() user: SessionUser, @Param('linkId') linkId: string): Promise<void> {
    await this.care.end(user, linkId);
  }
}
