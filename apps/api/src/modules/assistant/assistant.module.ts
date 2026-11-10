import { Module } from '@nestjs/common';

import { AssistantController } from './controllers/index.js';
import { AssistantService } from './services/index.js';
import { AssistantSwitchGuard } from '../../shared/guards/AssistantSwitch.guard.js';

/**
 * The nutrition assistant (project 023). Its clients — the answer's stream and
 * the label's structured call — come from the global AI module, on their own
 * provider and their own budget (`0104`).
 */
@Module({ controllers: [AssistantController], providers: [AssistantService, AssistantSwitchGuard] })
export class AssistantModule {}
