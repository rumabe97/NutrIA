import { Injectable } from '@nestjs/common';

import { FeedbackController } from 'core/controllers/Feedback';

import type { FeedbackInboxDto } from '../dto/out/index.js';
import type { HandleFeedbackDto } from '../dto/in/index.js';

@Injectable()
export class AdminFeedbackService {
  /** Lenient parsing, for the same reason the account pager is lenient. */
  async list(offset?: string, size?: string): Promise<FeedbackInboxDto> {
    return FeedbackController.list({ offset: Number.parseInt(offset ?? '', 10) || 0, size: Number.parseInt(size ?? '', 10) || undefined });
  }

  async setHandled(id: string, body: HandleFeedbackDto): Promise<void> {
    await FeedbackController.setHandled(id, body.handled);
  }
}
