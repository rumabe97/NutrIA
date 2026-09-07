import { Module } from '@nestjs/common';

import { SafetyRestController } from './safety.controller.js';

@Module({ controllers: [SafetyRestController] })
export class SafetyModule {}
