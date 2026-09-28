import { Injectable } from '@nestjs/common';

import { FeedbackController } from 'core/controllers/Feedback';

import type { FeedbackInboxDto } from '../dto/out/index.js';
import type { FeedbackQueryDto, HandleFeedbackDto } from '../dto/in/index.js';

@Injectable()
export class AdminFeedbackService {
  /** The query arrives validated (`FeedbackQueryDto`). */
  async list(query: FeedbackQueryDto): Promise<FeedbackInboxDto> {
    return FeedbackController.list(query);
  }

  async setHandled(id: string, body: HandleFeedbackDto): Promise<void> {
    await FeedbackController.setHandled(id, body.handled);
  }
}
