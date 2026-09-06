import { ConflictError, NotFoundError } from 'core/entities/Error';
import { ProfileRepository } from '#repositories/Profile';
import { UserRepository } from '#repositories/User';
import type { CreateProfile, Profile, UpdateProfile } from 'core/entities/Profile';

// --- Presenters ---------------------------------------------------------------

export interface ProfileView {
  id: string;
  avatarUrl: string | null;
  bio: string | null;
  updatedAt: string; // always ISO 8601
  userId: string;
  username: string;
}

function presentProfile(profile: Profile): ProfileView {
  return {
    id: profile.id,
    avatarUrl: profile.avatarUrl ?? null,
    bio: profile.bio ?? null,
    updatedAt: profile.updatedAt.toISOString(),
    userId: profile.userId,
    username: profile.username
  };
}

// --- Controller ---------------------------------------------------------------
//
// ProfileController imports TWO repositories — Profile and User.
// This is the standard pattern when a controller's business rules span domains:
//   - import the repository for the domain being operated on (ProfileRepository)
//   - import any other repositories needed for cross-domain validation (UserRepository)
//
// Never call another controller from here. Always go through the repository directly.

export const ProfileController = {
  async createProfile(input: CreateProfile): Promise<ProfileView> {
    // Cross-domain check: the user must exist before creating their profile.
    const user = await UserRepository.findById(input.userId);

    if (!user) {
      throw new NotFoundError(`User "${input.userId}" not found`);
    }

    const taken = await ProfileRepository.findByUsername(input.username);

    if (taken) {
      throw new ConflictError(`Username "${input.username}" is already taken`);
    }

    const profile = await ProfileRepository.create(input);

    return presentProfile(profile);
  },

  async deleteProfile(id: string): Promise<void> {
    const profile = await ProfileRepository.findById(id);

    if (!profile) {
      throw new NotFoundError(`Profile "${id}" not found`);
    }

    await ProfileRepository.delete(id);
  },

  async getProfileByUserId(input: { userId: string }): Promise<ProfileView> {
    const profile = await ProfileRepository.findByUserId(input.userId);

    if (!profile) {
      throw new NotFoundError(`No profile found for user "${input.userId}"`);
    }

    return presentProfile(profile);
  },

  async updateProfile(id: string, input: UpdateProfile): Promise<ProfileView> {
    const profile = await ProfileRepository.findById(id);

    if (!profile) {
      throw new NotFoundError(`Profile "${id}" not found`);
    }

    if (input.username) {
      const taken = await ProfileRepository.findByUsername(input.username);

      // Allow the same user to "re-claim" their own username in an update.
      if (taken && taken.id !== id) {
        throw new ConflictError(`Username "${input.username}" is already taken`);
      }
    }

    const updated = await ProfileRepository.update(id, input);

    // Defensive: a race (row deleted between the findById and this update, or RLS
    // suddenly excluding the caller) could yield zero affected rows even though the
    // findById succeeded. Surface as NotFoundError rather than presenting `undefined`.
    if (!updated) {
      throw new NotFoundError(`Profile "${id}" not found`);
    }

    return presentProfile(updated);
  }
};
