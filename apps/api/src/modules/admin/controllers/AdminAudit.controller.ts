import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AUDIT_ACTIONS } from 'core/entities/Audit';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from 'core/entities/AdminQuery';

import { AdminAuditService } from '../services/index.js';
import { AuditQueryDto } from '../dto/in/index.js';
import { Roles } from '../../../shared/index.js';
import { ZodQuery } from './ZodQuery.js';

import type { AdminAuditDto } from '../dto/out/index.js';

/**
 * Ajustes › Registro de acciones (`0071`): who did what, to which account, and
 * when — one row per admin mutation, written in the same transaction as the
 * action itself. Nothing here carries a request body or an IP address.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @ApiOkResponse({ description: 'One page of the trail, newest first. `total` counts every match. 422 INVALID_INPUT for an unknown action.' })
  @ApiOperation({ summary: 'The admin trail, filtered by action and paged (0071)' })
  @ApiQuery({ enum: AUDIT_ACTIONS, name: 'action', required: false })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ description: `1–${MAX_PAGE_SIZE}. ${DEFAULT_PAGE_SIZE} when absent.`, name: 'size', required: false, type: Number })
  @Get('audit')
  async list(@ZodQuery(AuditQueryDto) query: AuditQueryDto): Promise<AdminAuditDto> {
    return this.audit.list(query);
  }
}
