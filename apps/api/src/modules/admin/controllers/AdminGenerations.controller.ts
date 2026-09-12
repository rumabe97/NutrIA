import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminService } from '../services/index.js';
import { Roles } from '../../../shared/index.js';

import type { AdminGenerationDto } from '../dto/out/index.js';

/**
 * The generation log: the latest generations, who asked for each, and every
 * model call each made — which model answered, through which provider, how
 * long it took, the tokens, what a gateway reported and what became of the
 * dishes (`0050`).
 *
 * Its own controller because it carries a person — an address, nothing else of
 * theirs — and `0028` keeps every read that does visibly apart from the ones
 * that only count.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminGenerationsController {
  constructor(private readonly admin: AdminService) {}

  @ApiOkResponse({ description: 'The latest generations, newest first, each with its account and its model calls.' })
  @ApiOperation({ summary: 'The generation log, call by call' })
  @Get('generations')
  async list(): Promise<readonly AdminGenerationDto[]> {
    return this.admin.generations();
  }
}
