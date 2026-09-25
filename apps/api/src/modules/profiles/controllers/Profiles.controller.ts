import { Controller, Delete, Get, Patch, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Locale, ZodBody } from '../../../shared/index.js';
import { ProfilesService } from '../services/index.js';
import {
  GiveProfileConsentDto,
  SetTourSeenDto,
  UpdateGoalDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateTargetOverrideDto
} from '../dto/in/index.js';

import type { FullProfileDto, GoalDto, PreferencesDto, ProfileConsentDto, ProfileDto, TargetsDto, TourSeenDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The user id is taken from `@CurrentUser()` on every route and passed as the
 * first argument to the service. No route accepts a user id from the client.
 */
@ApiTags('profile')
@Controller('profile')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @ApiOkResponse({ description: 'Everything the profile screen needs, in one read.' })
  @ApiOperation({ summary: 'Profile, goal, preferences, restrictions and resolved daily targets' })
  @Get()
  async get(@CurrentUser() user: SessionUser, @Locale() locale: string | null): Promise<FullProfileDto> {
    return this.profiles.read(user.id, locale);
  }

  @ApiOkResponse({ description: 'Whether the current notice is consented to, and when it was.' })
  @ApiOperation({ summary: "The explicit consent to use the profile's health data" })
  @Get('consent')
  async consent(@CurrentUser() user: SessionUser): Promise<ProfileConsentDto> {
    return this.profiles.consent(user.id);
  }

  /**
   * Giving it: the body names the version read, and only the current one is
   * accepted. Giving it again records the moment again.
   */
  @ApiOkResponse({ description: 'The consent as it now stands.' })
  @ApiOperation({ summary: "Consent to the use of the profile's health data (RGPD art. 9.2.a)" })
  @Put('consent')
  async giveConsent(@CurrentUser() user: SessionUser, @ZodBody(GiveProfileConsentDto) body: GiveProfileConsentDto): Promise<ProfileConsentDto> {
    return this.profiles.giveConsent(user.id, body);
  }

  /**
   * Withdrawing it deletes what it covered — allergies, intolerances, way of
   * eating, goal, height and every weight — in one transaction, and reopens
   * the onboarding steps that collect them.
   */
  @ApiOkResponse({ description: 'The consent as it now stands: withdrawn.' })
  @ApiOperation({ summary: 'Withdraw the profile consent and delete the data it covered' })
  @Delete('consent')
  async withdrawConsent(@CurrentUser() user: SessionUser): Promise<ProfileConsentDto> {
    return this.profiles.withdrawConsent(user.id);
  }

  @ApiOkResponse({ description: 'The profile as it now stands.' })
  @ApiOperation({ summary: 'Update personal details' })
  @Patch()
  async update(@CurrentUser() user: SessionUser, @ZodBody(UpdateProfileDto) body: UpdateProfileDto): Promise<ProfileDto> {
    return this.profiles.update(user.id, body);
  }

  @ApiOkResponse({ description: 'The goal as it now stands.' })
  @ApiOperation({ summary: 'Update the active goal' })
  @Patch('goal')
  async updateGoal(@CurrentUser() user: SessionUser, @ZodBody(UpdateGoalDto) body: UpdateGoalDto): Promise<GoalDto> {
    return this.profiles.updateGoal(user.id, body);
  }

  /**
   * The bounds are checked in `packages/core`, not here: a limit enforced at the
   * HTTP edge would be a limit generation does not share.
   */
  @ApiOkResponse({ description: 'The resolved set, with the correction merged and re-judged.' })
  @ApiOperation({ summary: "Set or clear the user's own daily targets" })
  @Patch('targets')
  async updateTargets(@CurrentUser() user: SessionUser, @ZodBody(UpdateTargetOverrideDto) body: UpdateTargetOverrideDto): Promise<TargetsDto> {
    return this.profiles.updateTargets(user.id, body);
  }

  /**
   * The tour is marked seen by the screen that showed it, and unmarked by the
   * person who wants it again (`0038`). Both directions are the same route
   * because they are the same fact, written twice.
   */
  @ApiOkResponse({ description: 'The mark as it now stands.' })
  @ApiOperation({ summary: 'Mark the tour as seen, or ask for it again' })
  @Patch('tour')
  async setTourSeen(@CurrentUser() user: SessionUser, @ZodBody(SetTourSeenDto) body: SetTourSeenDto): Promise<TourSeenDto> {
    return this.profiles.setTourSeen(user.id, body);
  }

  @ApiOkResponse({ description: 'The preferences as they now stand.' })
  @ApiOperation({ summary: 'Update eating, lifestyle and cooking preferences' })
  @Patch('preferences')
  async updatePreferences(@CurrentUser() user: SessionUser, @ZodBody(UpdatePreferencesDto) body: UpdatePreferencesDto): Promise<PreferencesDto> {
    return this.profiles.updatePreferences(user.id, body);
  }
}
