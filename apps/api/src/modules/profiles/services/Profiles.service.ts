import { Injectable } from '@nestjs/common';

import { KitchenController } from 'core/controllers/Kitchen';
import { ProfileConsentController, ProfileController } from 'core/controllers/Profile';

import type { FullProfileDto, GoalDto, PreferencesDto, ProfileConsentDto, ProfileDto, TargetsDto, TourSeenDto } from '../dto/out/index.js';
import type {
  GiveProfileConsentDto,
  SetTourSeenDto,
  UpdateGoalDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateTargetOverrideDto
} from '../dto/in/index.js';

@Injectable()
export class ProfilesService {
  async consent(userId: string): Promise<ProfileConsentDto> {
    return ProfileConsentController.get(userId);
  }

  async giveConsent(userId: string, body: GiveProfileConsentDto): Promise<ProfileConsentDto> {
    return ProfileConsentController.give(userId, body.version);
  }

  async withdrawConsent(userId: string): Promise<ProfileConsentDto> {
    return ProfileConsentController.withdraw(userId);
  }

  async read(userId: string, locale: string | null): Promise<FullProfileDto> {
    const [profile, kitchen] = await Promise.all([ProfileController.getFullProfile(userId, locale), KitchenController.read(userId)]);

    return { ...profile, kitchen };
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
    const { kitchen: changes, ...preferences } = body;

    // The kitchen first: a refused fourth `prefers` then leaves the other
    // preferences as they were, rather than half of one request applied.
    const kitchen = changes ? await KitchenController.applyChanges(userId, changes) : await KitchenController.read(userId);

    return { ...(await ProfileController.updatePreferences(userId, preferences)), kitchen };
  }

  async updateTargets(userId: string, body: UpdateTargetOverrideDto): Promise<TargetsDto> {
    return ProfileController.updateTargets(userId, body);
  }
}
