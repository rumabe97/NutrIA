import { Injectable } from '@nestjs/common';

import { FeedbackController } from 'core/controllers/Feedback';

import type { SubmitFeedbackDto } from '../dto/in/index.js';

/**
 * One line, and worth its own file: the seam between the route and the domain
 * exists everywhere or it exists where somebody once needed it (`0039`).
 */
@Injectable()
export class FeedbackService {
  async submit(userId: string, body: SubmitFeedbackDto): Promise<void> {
    await FeedbackController.submit(userId, body);
  }
}
