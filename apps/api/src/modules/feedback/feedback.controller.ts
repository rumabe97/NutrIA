import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { FeedbackController } from 'core/controllers/Feedback';
import { submitFeedbackSchema } from 'core/entities/Feedback';

import { CurrentUser, RateLimit } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { SessionUser } from '../../shared/decorators/index.js';
import type { SubmitFeedback } from 'core/entities/Feedback';

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
export class FeedbackRestController {
  @ApiOperation({ summary: 'Send the owner a message' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  @RateLimit({ limit: 5, ttlSeconds: 3600 })
  async submit(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(submitFeedbackSchema)) body: SubmitFeedback): Promise<void> {
    await FeedbackController.submit(user.id, body);
  }
}
