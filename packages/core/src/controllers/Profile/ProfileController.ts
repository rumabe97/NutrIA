import { NotFoundError } from 'core/entities/Error';
import { ageInYears, nutritionTargets } from 'core/domain/Nutrition';
import { ProfileRepository } from '#repositories/Profile';
import { SafetyRepository } from '#repositories/Safety';
import type { Goal, Preferences, Profile, UpdateGoal, UpdatePreferences, UpdateProfile } from 'core/entities/Profile';
import type { NutritionTargets } from 'core/entities/Nutrition';

// --- Presenters ---------------------------------------------------------------

export interface ProfileView {
  id: string;
  birthDate: string | null;
  country: string | null;
  displayName: string | null;
  heightCm: number | null;
  locale: string;
  sex: Profile['sex'];
  timezone: string;
  updatedAt: string;
}

export interface GoalView {
  id: string;
  customGoal: string | null;
  paceKgPerWeek: number | null;
  startingWeightKg: number | null;
  targetWeightKg: number | null;
  type: Goal['type'];
}

export type PreferencesView = Omit<Preferences, 'createdAt' | 'updatedAt' | 'userId'>;

export interface FullProfileView {
  allergies: readonly { allergenId: string; allergenLabel: string; crossContaminationSensitive: boolean; severity: string }[];
  cuisines: readonly string[];
  dietaryPatterns: readonly string[];
  foodPreferences: readonly { ingredientId: string | null; label: string; sentiment: 'disliked' | 'liked' }[];
  goal: GoalView | null;
  intolerances: readonly { allergenId: string; allergenLabel: string }[];
  preferences: PreferencesView | null;
  profile: ProfileView | null;
  /** Null until enough of the profile exists to compute it honestly. */
  targets: (NutritionTargets & { wasClamped: boolean }) | null;
}

function presentProfile(profile: Profile): ProfileView {
  return {
    id: profile.id,
    birthDate: profile.birthDate,
    country: profile.country,
    displayName: profile.displayName,
    heightCm: profile.heightCm,
    locale: profile.locale,
    sex: profile.sex,
    timezone: profile.timezone,
    updatedAt: profile.updatedAt.toISOString()
  };
}

function presentGoal(goal: Goal): GoalView {
  return {
    id: goal.id,
    customGoal: goal.customGoal,
    paceKgPerWeek: goal.paceKgPerWeek,
    startingWeightKg: goal.startingWeightKg,
    targetWeightKg: goal.targetWeightKg,
    type: goal.type
  };
}

function presentPreferences(preferences: Preferences): PreferencesView {
  const { createdAt: _createdAt, updatedAt: _updatedAt, userId: _userId, ...view } = preferences;

  return view;
}

/**
 * Daily targets, or null.
 *
 * Returning null when the inputs are incomplete is the point: a placeholder
 * calorie figure computed from a guessed height or an assumed sex is a number
 * the user would act on. Absent is honest; approximate is not.
 */
function computeTargets(profile: Profile | undefined, goal: Goal | undefined, preferences: Preferences | undefined) {
  if (!profile?.birthDate || !profile.heightCm || !profile.sex || !goal || !preferences?.activityLevel) {return null;}

  const weightKg = goal.startingWeightKg;

  if (!weightKg) {return null;}

  return nutritionTargets({
    activityLevel: preferences.activityLevel,
    ageYears: ageInYears(profile.birthDate),
    goal: goal.type,
    heightCm: profile.heightCm,
    paceKgPerWeek: goal.paceKgPerWeek,
    sex: profile.sex,
    weightKg
  });
}

// --- Controller ---------------------------------------------------------------

export const ProfileController = {
  /** One round trip's worth of everything the profile and dashboard screens need. */
  async getFullProfile(userId: string): Promise<FullProfileView> {
    const [profile, goal, preferences, dietaryPatterns, foodPreferences, cuisines, allergies, intolerances] = await Promise.all([
      ProfileRepository.findByUserId(userId),
      ProfileRepository.findActiveGoal(userId),
      ProfileRepository.findPreferences(userId),
      ProfileRepository.findDietaryPatterns(userId),
      ProfileRepository.findFoodPreferences(userId),
      ProfileRepository.findCuisines(userId),
      SafetyRepository.findAllergies(userId),
      SafetyRepository.findIntolerances(userId)
    ]);

    return {
      allergies: allergies.map(a => ({
        allergenId: a.allergenId,
        allergenLabel: a.allergenLabel,
        crossContaminationSensitive: a.crossContaminationSensitive,
        severity: a.severity
      })),
      cuisines,
      dietaryPatterns,
      foodPreferences,
      goal: goal ? presentGoal(goal) : null,
      intolerances: intolerances.map(i => ({ allergenId: i.allergenId, allergenLabel: i.allergenLabel })),
      preferences: preferences ? presentPreferences(preferences) : null,
      profile: profile ? presentProfile(profile) : null,
      targets: computeTargets(profile, goal, preferences)
    };
  },

  async getProfile(userId: string): Promise<ProfileView> {
    const profile = await ProfileRepository.findByUserId(userId);

    if (!profile) {throw new NotFoundError('Profile not found');}

    return presentProfile(profile);
  },

  async updateGoal(userId: string, input: UpdateGoal): Promise<GoalView> {
    return presentGoal(await ProfileRepository.upsertGoal(userId, input));
  },

  async updatePreferences(userId: string, input: UpdatePreferences): Promise<PreferencesView> {
    return presentPreferences(await ProfileRepository.upsertPreferences(userId, input));
  },

  async updateProfile(userId: string, input: UpdateProfile): Promise<ProfileView> {
    return presentProfile(await ProfileRepository.upsert(userId, input));
  }
};
