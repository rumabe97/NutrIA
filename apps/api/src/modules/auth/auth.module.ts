import { Global, Module } from '@nestjs/common';

import { ENV, envProvider } from '../../config/index.js';
import { AUTH, createAuth } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { EmailModule } from '../email/email.module.js';
import { EmailService } from '../email/Email.service.js';
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
  imports: [EmailModule],
  providers: [
    { inject: [ENV, EmailService], provide: AUTH, useFactory: (env: Env, mailer: EmailService) => createAuth(env, mailer) },
    SessionGuard,
    envProvider
  ]
})
export class AuthModule {}
