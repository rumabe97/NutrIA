import { Module } from '@nestjs/common';

import { FeedbackController } from './controllers/index.js';
import { FeedbackService } from './services/index.js';

@Module({ controllers: [FeedbackController], providers: [FeedbackService] })
export class FeedbackModule {}
