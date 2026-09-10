import { Module } from '@nestjs/common';

import { FeedbackRestController } from './feedback.controller.js';

@Module({ controllers: [FeedbackRestController] })
export class FeedbackModule {}
