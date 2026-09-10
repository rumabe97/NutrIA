import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AdminFeedbackService } from '../services/index.js';
import { HandleFeedbackDto } from '../dto/in/index.js';
import { Roles, ZodBody } from '../../../shared/index.js';

import type { FeedbackInboxDto } from '../dto/out/index.js';

/**
 * The one admin read that carries a person (`0037`): the message *and* the
 * address, because the message was written to be read, by a person, who is
 * expected to answer it. Nothing summarises it and it never reaches a model.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminFeedbackController {
  constructor(private readonly feedback: AdminFeedbackService) {}

  @ApiOkResponse({ description: 'One page of messages, newest first, with the unhandled count.' })
  @ApiOperation({ summary: 'What people wrote, newest first' })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @Get('feedback')
  async list(@Query('offset') offset?: string, @Query('size') size?: string): Promise<FeedbackInboxDto> {
    return this.feedback.list(offset, size);
  }

  @ApiNoContentResponse({ description: 'Marked, or put back. The mark is reversible on purpose.' })
  @ApiOperation({ summary: 'Mark a message dealt with, or put it back' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('feedback/:id')
  async setHandled(@Param('id', ParseUUIDPipe) id: string, @ZodBody(HandleFeedbackDto) body: HandleFeedbackDto): Promise<void> {
    await this.feedback.setHandled(id, body);
  }
}
