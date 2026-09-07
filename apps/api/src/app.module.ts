import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { envProvider, validateEnv } from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthDataModule } from './modules/health-data/health-data.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MealPlansModule } from './modules/meal-plans/meal-plans.module.js';
import { OnboardingModule } from './modules/onboarding/onboarding.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { SafetyModule } from './modules/safety/safety.module.js';
import { ShoppingListsModule } from './modules/shopping-lists/shopping-lists.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AllExceptionsFilter } from './shared/filters/index.js';
import { AdminGuard, RateLimitGuard, RequiresOnboardingGuard, SessionGuard } from './shared/guards/index.js';
import { NoStoreCacheInterceptor } from './shared/interceptors/index.js';

import type { Env } from './config/index.js';


@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          // Health checks are the loudest and least informative lines in the log.
          autoLogging: { ignore: req => req.url?.startsWith('/api/v1/health') ?? false },
          level: config.get('LOG_LEVEL', { infer: true }),
          // Redaction is not optional here: bodies carry health data and headers
          // carry session cookies.
          //
          // The three health fields are listed even though pino-http does not log
          // bodies by default. The list is what survives someone turning body
          // logging on to debug something at 2am — and a medication name in a log
          // file is not a mistake anyone can take back. Extend it in the same
          // change that adds a field, never afterwards.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.newPassword',
              'req.body.conditions',
              'req.body.medications',
              'req.body.supplements'
            ],
            remove: true
          },
          transport: config.get('NODE_ENV', { infer: true }) === 'development' ? { target: 'pino-pretty' } : undefined
        }
      })
    }),
    DatabaseModule,
    AiModule,
    AuthModule,
    HealthDataModule,
    HealthModule,
    MealPlansModule,
    OnboardingModule,
    ProfilesModule,
    ProgressModule,
    SafetyModule,
    ShoppingListsModule,
    UsersModule
  ],
  providers: [
    envProvider,
    // Order matters: throttling before authentication, so an unauthenticated
    // flood is rejected before it costs a session lookup per request.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_GUARD, useClass: RequiresOnboardingGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: NoStoreCacheInterceptor }
  ]
})
export class AppModule {}
