import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CareService } from '../services/index.js';
import { CurrentUser, Locale, RateLimit } from '../../../shared/index.js';
import { ProfessionalGuard } from '../../../shared/guards/Professional.guard.js';

import type { CareClientOverviewDto, CareClientsDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The professional reading their clients (`0059`, project 004 Phase 3).
 *
 * `ProfessionalGuard` on the class — the switch and the grant, read per
 * request, anything else a 404 before any pipe runs — and never
 * `@RequiresOnboarding()`. A route takes a **link** id, never a client's: the
 * client's id exists only inside `CareController.withClient`, which resolves
 * the link against the session and writes the client's trail. No
 * `ParseUUIDPipe`: a path that is not a link id is the same 404 as a link that
 * is not the caller's.
 */
@ApiTags('care')
@Controller('care')
@UseGuards(ProfessionalGuard)
export class CareClientsController {
  constructor(private readonly care: CareService) {}

  @ApiOkResponse({
    description:
      'Each client with an open link and where they are, and the invitations still unanswered. Writes one `list` row in the trail of every client with an active link.'
  })
  @ApiOperation({ summary: 'The professional’s clients' })
  @Get('clients')
  // Every call writes a row in each active client's trail: a tighter limit than the global
  // one keeps a burst of list calls from burying an earlier read pages deep.
  @RateLimit({ limit: 10, ttlSeconds: 60 })
  async clients(@CurrentUser() professional: SessionUser): Promise<CareClientsDto> {
    return this.care.clients(professional);
  }

  @ApiOkResponse({
    description:
      'The client’s plan and plan history, progress and targets; `health` only under the link’s health line, absent otherwise. One `overview` row in the client’s trail, and one `health` row when health is included. 404 for any link that is not the caller’s and active.'
  })
  @ApiOperation({ summary: 'One client’s page, through their link' })
  @Get('clients/:linkId')
  async overview(
    @CurrentUser() professional: SessionUser,
    @Param('linkId') linkId: string,
    @Locale() locale: string | null
  ): Promise<CareClientOverviewDto> {
    return this.care.overview(professional, linkId, locale);
  }
}
