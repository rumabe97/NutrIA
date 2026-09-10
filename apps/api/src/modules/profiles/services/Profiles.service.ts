import { Injectable } from '@nestjs/common';

import { ProfileController } from 'core/controllers/Profile';

import type { FullProfileDto, GoalDto, PreferencesDto, ProfileDto, TargetsDto, TourSeenDto } from '../dto/out/index.js';
import type { SetTourSeenDto, UpdateGoalDto, UpdatePreferencesDto, UpdateProfileDto, UpdateTargetOverrideDto } from '../dto/in/index.js';

@Injectable()
export class ProfilesService {
  async read(userId: string, locale: string | null): Promise<FullProfileDto> {
    return ProfileController.getFullProfile(userId, locale);
  }

  /**
   * The write answers with the fact it wrote rather than re-reading the
   * profile: `packages/core` returns nothing here, and a second query to learn
   * what we just said would be a round trip to confirm our own sentence.
   */
  async setTourSeen(userId: string, body: SetTourSeenDto): Promise<TourSeenDto> {
    await ProfileController.setTourSeen(userId, body.seen);

    return { seen: body.seen };
  }

  async update(userId: string, body: UpdateProfileDto): Promise<ProfileDto> {
    return ProfileController.updateProfile(userId, body);
  }

  async updateGoal(userId: string, body: UpdateGoalDto): Promise<GoalDto> {
    return ProfileController.updateGoal(userId, body);
  }

  async updatePreferences(userId: string, body: UpdatePreferencesDto): Promise<PreferencesDto> {
    return ProfileController.updatePreferences(userId, body);
  }

  async updateTargets(userId: string, body: UpdateTargetOverrideDto): Promise<TargetsDto> {
    return ProfileController.updateTargets(userId, body);
  }
}
