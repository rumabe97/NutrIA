import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ProfileController } from 'core/controllers/Profile';
import { updateGoalSchema, updatePreferencesSchema, updateProfileSchema } from 'core/entities/Profile';
import { updateTargetOverrideSchema } from 'core/entities/Nutrition';

import { CurrentUser, Locale } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { FullProfileView, GoalView, PreferencesView, ProfileView } from 'core/controllers/Profile';
import type { ResolvedTargets } from 'core/domain/Nutrition';
import type { UpdateTargetOverride } from 'core/entities/Nutrition';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { UpdateGoal, UpdatePreferences, UpdateProfile } from 'core/entities/Profile';

/**
 * The user id is taken from `@CurrentUser()` on every route and passed as the
 * first argument to the controller. No route accepts a user id from the client.
 */
@ApiTags('profile')
@Controller('profile')
export class ProfilesController {
  @ApiOperation({ summary: 'Profile, goal, preferences, restrictions and resolved daily targets' })
  @Get()
  async get(@CurrentUser() user: SessionUser, @Locale() locale: string | null): Promise<FullProfileView> {
    return ProfileController.getFullProfile(user.id, locale);
  }

  @ApiOperation({ summary: 'Update personal details' })
  @Patch()
  async update(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfile): Promise<ProfileView> {
    return ProfileController.updateProfile(user.id, body);
  }

  @ApiOperation({ summary: 'Update the active goal' })
  @Patch('goal')
  async updateGoal(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(updateGoalSchema)) body: UpdateGoal): Promise<GoalView> {
    return ProfileController.updateGoal(user.id, body);
  }

  /**
   * The bounds are checked in `packages/core`, not here: a limit enforced at the
   * HTTP edge would be a limit generation does not share.
   */
  @ApiOperation({ summary: 'Set or clear the user\'s own daily targets' })
  @Patch('targets')
  async updateTargets(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(updateTargetOverrideSchema)) body: UpdateTargetOverride
  ): Promise<ResolvedTargets> {
    return ProfileController.updateTargets(user.id, body);
  }

  @ApiOperation({ summary: 'Update eating, lifestyle and cooking preferences' })
  @Patch('preferences')
  async updatePreferences(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(updatePreferencesSchema)) body: UpdatePreferences): Promise<PreferencesView> {
    return ProfileController.updatePreferences(user.id, body);
  }
}
