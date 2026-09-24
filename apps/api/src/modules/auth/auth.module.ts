import { Global, Module } from '@nestjs/common';

import { AUTH, createAuth } from './auth.config.js';
import { AuthController } from './controllers/index.js';
import { AuthHandlerService } from './services/index.js';
import { BillingModule } from '../billing/billing.module.js';
import { BillingService } from '../billing/services/Billing.service.js';
import { EmailModule } from '../email/email.module.js';
import { EmailService } from '../email/services/Email.service.js';
import { ENV, envProvider } from '../../config/index.js';
import { SessionGuard } from '../../shared/guards/Session.guard.js';

import type { Env } from '../../config/index.js';

/**
 * Global because `SessionGuard` is registered application-wide — every module's
 * routes need the auth instance, and threading it through each one adds an
 * import with no decision behind it.
 */
@Global()
@Module({
  controllers: [AuthController],
  exports: [AUTH, ENV, SessionGuard],
  imports: [BillingModule, EmailModule],
  providers: [
    {
      inject: [ENV, EmailService, BillingService],
      provide: AUTH,
      useFactory: (env: Env, mailer: EmailService, billing: BillingService) => createAuth(env, mailer, billing)
    },
    AuthHandlerService,
    SessionGuard,
    envProvider
  ]
})
export class AuthModule {}
