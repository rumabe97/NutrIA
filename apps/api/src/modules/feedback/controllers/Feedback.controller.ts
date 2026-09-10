import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RateLimit, ZodBody } from '../../../shared/index.js';
import { SubmitFeedbackDto } from '../dto/in/index.js';
import { FeedbackService } from '../services/index.js';

import type { SessionUser } from '../../../shared/index.js';

/**
 * Writing to the owner (`0037`).
 *
 * Signed in, because a reply needs somewhere to go and an anonymous box is a
 * spam box. Rate limited, because a text field open to the internet is a text
 * field somebody will fill: a handful an hour is far above what a person with
 * something to say needs and far below what a script wants.
 */
@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @ApiNoContentResponse({ description: 'Stored. Nothing is echoed back — the message was written to be read by a person.' })
  @ApiOperation({ summary: 'Send the owner a message' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  @RateLimit({ limit: 5, ttlSeconds: 3600 })
  async submit(@CurrentUser() user: SessionUser, @ZodBody(SubmitFeedbackDto) body: SubmitFeedbackDto): Promise<void> {
    await this.feedback.submit(user.id, body);
  }
}
