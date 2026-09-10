import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { envProvider, validateEnv } from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { AdminModule } from './modules/admin/index.js';
import { AiModule } from './modules/ai/index.js';
import { AuthModule } from './modules/auth/index.js';
import { CheckInsModule } from './modules/check-ins/index.js';
import { FeedbackModule } from './modules/feedback/index.js';
import { HealthDataModule } from './modules/health-data/index.js';
import { HealthModule } from './modules/health/index.js';
import { MealPlansModule } from './modules/meal-plans/index.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { OnboardingModule } from './modules/onboarding/index.js';
import { ProfilesModule } from './modules/profiles/index.js';
import { ProgressModule } from './modules/progress/index.js';
import { RecipesModule } from './modules/recipes/index.js';
import { SafetyModule } from './modules/safety/index.js';
import { SettingsModule } from './modules/settings/index.js';
import { ShoppingListsModule } from './modules/shopping-lists/index.js';
import { UsersModule } from './modules/users/index.js';
import { VacationsModule } from './modules/vacations/index.js';
import { AllExceptionsFilter } from './shared/filters/index.js';
import { ObservabilityModule } from './shared/observability/index.js';
import { AdminGuard, RateLimitGuard, RequiresOnboardingGuard, SessionGuard, VerifiedEmailGuard } from './shared/guards/index.js';
import { NoStoreCacheInterceptor } from './shared/interceptors/index.js';
import { LoggingModule } from './shared/logging/index.js';



@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true, validate: validateEnv }),
    LoggingModule,
    ObservabilityModule,
    DatabaseModule,
    AdminModule,
    AiModule,
    AuthModule,
    CheckInsModule,
    FeedbackModule,
    HealthDataModule,
    HealthModule,
    MealPlansModule,
    NotificationsModule,
    OnboardingModule,
    ProfilesModule,
    ProgressModule,
    RecipesModule,
    SafetyModule,
    SettingsModule,
    ShoppingListsModule,
    UsersModule,
    VacationsModule
  ],
  providers: [
    envProvider,
    // Order matters: throttling before authentication, so an unauthenticated
    // flood is rejected before it costs a session lookup per request.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: VerifiedEmailGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_GUARD, useClass: RequiresOnboardingGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: NoStoreCacheInterceptor }
  ]
})
export class AppModule {}
