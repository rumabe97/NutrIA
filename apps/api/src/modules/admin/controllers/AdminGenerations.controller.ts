import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DEFAULT_PAGE_SIZE, GENERATION_SINCE, GENERATION_STATUSES, MAX_PAGE_SIZE } from 'core/entities/AdminQuery';
import { PERIODS } from 'core/entities/Period';

import { AdminService } from '../services/index.js';
import { GenerationsQueryDto, PeriodQueryDto } from '../dto/in/index.js';
import { Roles } from '../../../shared/index.js';
import { ZodQuery } from './ZodQuery.js';

import type { AdminGenerationDto, AdminGenerationsDto, AdminGenerationStatsDto } from '../dto/out/index.js';

/**
 * The generation log: every generation, who asked for each, and every model
 * call each made — which model answered, through which provider, how long it
 * took, the tokens, what a gateway reported and what became of the dishes
 * (`0050`).
 *
 * Its own controller because it carries a person — an address, nothing else of
 * theirs — and `0028` keeps every read that does visibly apart from the ones
 * that only count. The address search narrows the log; it shows nothing the
 * log did not already show.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminGenerationsController {
  constructor(private readonly admin: AdminService) {}

  @ApiOkResponse({
    description:
      'One page of generations, newest first, each with its account and its model calls, and `total`, every generation the filters match. With `legacy=1`, the latest 20 as an array, as before (until phase 9). 422 INVALID_INPUT for an unknown filter value or a range that ends before it starts.'
  })
  @ApiOperation({ summary: 'The generation log, filtered and paged (0050, 0068)' })
  @ApiQuery({ enum: GENERATION_STATUSES, name: 'status', required: false })
  @ApiQuery({ description: 'A failure code, exactly, e.g. `GENERATION_AI_UNAVAILABLE`.', name: 'code', required: false, type: String })
  @ApiQuery({ description: 'Address contains, case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ description: 'The last 24 hours, or a period in Madrid days.', enum: GENERATION_SINCE, name: 'since', required: false })
  @ApiQuery({ description: 'First Madrid day, `YYYY-MM-DD`, included.', name: 'from', required: false, type: String })
  @ApiQuery({ description: 'Last Madrid day, `YYYY-MM-DD`, included.', name: 'to', required: false, type: String })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ description: `1–${MAX_PAGE_SIZE}. ${DEFAULT_PAGE_SIZE} when absent.`, name: 'size', required: false, type: Number })
  @ApiQuery({ description: "Today's unpaged array, until phase 9.", enum: ['1'], name: 'legacy', required: false })
  @Get('generations')
  async list(@ZodQuery(GenerationsQueryDto) query: GenerationsQueryDto): Promise<AdminGenerationsDto | readonly AdminGenerationDto[]> {
    return query.legacy === '1' ? this.admin.generations() : this.admin.generationsPage(query);
  }

  @ApiOkResponse({
    description:
      'Generations per day by status, the median and 95th-percentile duration per day of the ones that finished (seconds, null for a day with none), and failures by code. Counts and durations only. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: "The generation log's charts over a period (0068)" })
  @ApiQuery({ description: 'Days, in Europe/Madrid calendar days. 30 when absent.', enum: PERIODS.map(String), name: 'period', required: false })
  @Get('generations/stats')
  async stats(@ZodQuery(PeriodQueryDto) query: PeriodQueryDto): Promise<AdminGenerationStatsDto> {
    return this.admin.generationStats(query);
  }
}
