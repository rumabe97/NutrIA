import { Module } from '@nestjs/common';

import { envProvider } from '../../config/index.js';
import { EmailService } from './Email.service.js';

@Module({ exports: [EmailService], providers: [EmailService, envProvider] })
export class EmailModule {}
