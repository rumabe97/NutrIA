import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CareService } from '../services/index.js';
import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { SetLinkHealthDto } from '../dto/in/index.js';

import type { CareAccessPageDto, CareLinkDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * A link that exists (`0059`): the client seeing it and its trail, switching
 * its health line on and off, and either side ending it.
 *
 * **No switch here, deliberately.** Consent is revocable (PRD 004, criterion
 * 4): a client sees what they agreed to and can take it back whatever the
 * `professional` switch says. The professional's side of ending is the one
 * part that needs the switch and the grant, and `CareController.end` asks
 * for both before it tries it. A client with no link gets the same answer
 * with the switch on or off — `null`, or a 404 for a link that is not theirs —
 * so leaving the switch off these routes tells nobody anything. The health
 * line is the same: the client's own consent, theirs to take back or give
 * whatever the switch says (`docs/legal/analisis.md` P0-1). The trail
 * (`GET /care/access-log`) is the same: what a professional read about
 * somebody stays theirs to read, and an account nobody read gets an empty page.
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

  @ApiOkResponse({ description: 'The link, with the health line as it now stands. 404 when the account has no active or paused link.' })
  @ApiOperation({ summary: 'Start or stop sharing the health line on the signed-in client’s link, without ending it' })
  @Patch('links/me')
  async setSharesHealth(@CurrentUser() user: SessionUser, @ZodBody(SetLinkHealthDto) body: SetLinkHealthDto): Promise<CareLinkDto> {
    return this.care.setSharesHealth(user, body);
  }

  @ApiOkResponse({
    description:
      'Every time a professional reached the account’s data — who, what kind, read or write, when — newest first, 100 a page; `next` is the following page’s `before`, null on the last.'
  })
  @ApiOperation({ summary: 'The signed-in client’s access trail' })
  @ApiQuery({ description: 'The `next` of the previous page.', name: 'before', required: false })
  @Get('access-log')
  async accessLog(@CurrentUser() user: SessionUser, @Query('before') before?: string): Promise<CareAccessPageDto> {
    return this.care.accessLog(user, before ?? null);
  }

  @ApiNoContentResponse({ description: 'Ended. 404 for a link the account is not on, one already ended, or anything that is not a link id.' })
  @ApiOperation({ summary: 'End a link, from either side' })
  @Delete('links/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async end(@CurrentUser() user: SessionUser, @Param('linkId') linkId: string): Promise<void> {
    await this.care.end(user, linkId);
  }
}
