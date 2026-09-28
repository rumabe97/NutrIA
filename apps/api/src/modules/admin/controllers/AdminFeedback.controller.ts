import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AdminFeedbackService } from '../services/index.js';
import { DEFAULT_PAGE_SIZE, FEEDBACK_SORTS, FEEDBACK_STATES, MAX_PAGE_SIZE, SORT_DIRECTIONS } from 'core/entities/AdminQuery';

import { FeedbackQueryDto, HandleFeedbackDto } from '../dto/in/index.js';
import { ZodQuery } from './ZodQuery.js';
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

  @ApiOkResponse({
    description:
      'One page of messages, newest first unless asked otherwise; `total` counts the matches and `waiting` every unhandled message. 422 INVALID_INPUT for an unknown sort or state.'
  })
  @ApiOperation({ summary: 'Search, filter and page what people wrote (0068)' })
  @ApiQuery({ description: 'Message or sender address contains, case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ enum: FEEDBACK_STATES, name: 'state', required: false })
  @ApiQuery({ enum: FEEDBACK_SORTS, name: 'sort', required: false })
  @ApiQuery({ enum: SORT_DIRECTIONS, name: 'dir', required: false })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ description: `1–${MAX_PAGE_SIZE}. ${DEFAULT_PAGE_SIZE} when absent.`, name: 'size', required: false, type: Number })
  @Get('feedback')
  async list(@ZodQuery(FeedbackQueryDto) query: FeedbackQueryDto): Promise<FeedbackInboxDto> {
    return this.feedback.list(query);
  }

  @ApiNoContentResponse({ description: 'Marked, or put back. The mark is reversible on purpose.' })
  @ApiOperation({ summary: 'Mark a message dealt with, or put it back' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('feedback/:id')
  async setHandled(@Param('id', ParseUUIDPipe) id: string, @ZodBody(HandleFeedbackDto) body: HandleFeedbackDto): Promise<void> {
    await this.feedback.setHandled(id, body);
  }
}
