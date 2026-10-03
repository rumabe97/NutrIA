import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public, RateLimit } from '../../../shared/index.js';
import { CspReportService } from '../services/index.js';

/**
 * Where a browser reports what the web's report-only Content-Security-Policy would have
 * blocked (project 011, phase 9).
 *
 * Public, because the browser sends it without credentials, and rate limited by address:
 * the one signed-out route that writes a log line. The body is read by a parser registered
 * for the report content types in `createApp`.
 */
@ApiTags('csp-report')
@Controller('csp-report')
@Public()
export class CspReportController {
  constructor(private readonly reports: CspReportService) {}

  @ApiNoContentResponse({ description: 'Logged as a directive and an origin. Nothing is stored.' })
  @ApiOperation({ summary: 'Receive a Content-Security-Policy violation report' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  @RateLimit({ limit: 60, ttlSeconds: 60 })
  report(@Body() body: unknown): void {
    this.reports.record(body);
  }
}
