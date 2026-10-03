import { Module } from '@nestjs/common';

import { CspReportController } from './controllers/index.js';
import { CspReportService } from './services/index.js';

@Module({ controllers: [CspReportController], providers: [CspReportService] })
export class CspReportModule {}
