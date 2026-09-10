import { InputParseError, NotFoundError } from 'core/entities/Error';
import { ageInYears, resolveTargets } from 'core/domain/Nutrition';
import { FALLBACK_LOCALE } from '#repositories/Recipe';
import { isEnforceableDislike } from 'core/domain/Preference';
import { ProfileRepository } from '#repositories/Profile';
import { ProgressRepository } from '#repositories/Progress';
import { SafetyRepository } from '#repositories/Safety';
import type { Goal, Preferences, Profile, UpdateGoal, UpdatePreferences, UpdateProfile } from 'core/entities/Profile';
import type { ResolvedTargets, TargetInput, TargetViolation } from 'core/domain/Nutrition';
import type { UpdateTargetOverride } from 'core/entities/Nutrition';

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
  /** Whether the tour has been shown, so a screen knows to offer it (`0038`). */
  tourSeen: boolean;
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
  /**
   * Free-text allergies. `ingredientName` non-null means the entry resolved and
   * is enforced by the gate; null means best-effort, and every screen showing it
   * has to say so.
   */
  customAllergens: readonly { ingredientId: string | null; ingredientName: string | null; label: string }[];
  dietaryPatterns: readonly string[];
  /**
   * `enforced` answers the only question that matters about a dislike: is it a
   * promise or a request. True when the catalogue can act on it — a group word
   * or an ingredient it knows — and false when all the product can do is ask
   * the model. Always false for a like, which cannot be enforced by anything.
   */
  foodPreferences: readonly { enforced: boolean; ingredientId: string | null; label: string; sentiment: 'disliked' | 'liked' }[];
  goal: GoalView | null;
  intolerances: readonly { allergenId: string; allergenLabel: string }[];
  preferences: PreferencesView | null;
  profile: ProfileView | null;
  /**
   * Computed targets, the user's correction, and which is in effect — resolved
   * once, here, so no consumer has to decide. Generation reads `effective` from
   * this same call rather than recomputing, because two implementations of the
   * same rule is how one of them ends up wrong.
   *
   * Null until enough of the profile exists to compute it honestly.
   */
  targets: ResolvedTargets | null;
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
    tourSeen: profile.tourSeenAt !== null,
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

/**
 * Postgres hands back a `time` column as `HH:MM:SS`; `updatePreferencesSchema`
 * accepts `HH:MM` and nothing else.
 *
 * Left as stored, the lifestyle step of onboarding refills its fields with the
 * exact value the API gave it and the resave is refused as invalid — an answer
 * that saves the first time and fails the second, for someone who changed
 * nothing. The API reads a time of day in the same shape it writes one.
 */
function timeOfDay(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

function presentPreferences(preferences: Preferences): PreferencesView {
  const { createdAt: _createdAt, updatedAt: _updatedAt, userId: _userId, ...view } = preferences;

  return { ...view, sleepEnd: timeOfDay(view.sleepEnd), sleepStart: timeOfDay(view.sleepStart), trainingTime: timeOfDay(view.trainingTime) };
}

/**
 * The inputs the equations need, or null.
 *
 * Returning null when they are incomplete is the point: a placeholder calorie
 * figure computed from a guessed height or an assumed sex is a number the user
 * would act on. Absent is honest; approximate is not.
 */
/**
 * The weight the targets are computed against is the latest one logged — a
 * weigh-in or a check-in — and only before any of those the weight given at
 * onboarding. A target computed from a weight a fortnight old is a target for
 * someone else.
 */
function targetInput(profile: Profile | undefined, goal: Goal | undefined, preferences: Preferences | undefined, latestWeightKg: number | null): TargetInput | null {
  if (!profile?.birthDate || !profile.heightCm || !profile.sex || !goal || !preferences?.activityLevel) {return null;}

  const weightKg = latestWeightKg ?? goal.startingWeightKg;

  if (!weightKg) {return null;}

  return {
    activityLevel: preferences.activityLevel,
    ageYears: ageInYears(profile.birthDate),
    goal: goal.type,
    heightCm: profile.heightCm,
    paceKgPerWeek: goal.paceKgPerWeek,
    sex: profile.sex,
    weightKg
  };
}

/**
 * Applies one field of a patch.
 *
 * `undefined` and `null` are not the same request: absent leaves the stored
 * value alone, `null` clears that field back to the computed one. Collapsing
 * them with `??` would make "reset my protein" indistinguishable from "don't
 * touch my protein".
 */
function merge(patched: number | null | undefined, stored: number | null | undefined): number | null {
  return patched === undefined ? (stored ?? null) : patched;
}

/**
 * Turns a bound the user crossed into the sentence that names it.
 *
 * A refusal that says only "invalid" teaches nothing; this one says which limit,
 * and what the limit is, so the next attempt can be right.
 */
function explain(violation: TargetViolation): string {
  switch (violation.kind) {
    case 'fat_below_floor':
      return `Las grasas no pueden bajar de ${Math.ceil(violation.floor)} g: por debajo no se cubren las vitaminas liposolubles ni los ácidos grasos esenciales.`;
    case 'kcal_above_ceiling':
      return `El máximo para tu perfil son ${Math.floor(violation.ceiling)} kcal, un 20 % por encima de tu mantenimiento.`;
    case 'kcal_below_floor':
      return `El mínimo para tu perfil son ${Math.ceil(violation.floor)} kcal. Por debajo no construimos un plan sin supervisión profesional.`;
    case 'macros_do_not_sum':
      return `Los macros suman ${Math.round(violation.macroKcal)} kcal y has pedido ${violation.kcal}. Ajusta uno de los dos para que cuadren.`;
    case 'protein_above_ceiling':
      return `El máximo de proteína para tu peso son ${Math.floor(violation.ceiling)} g al día.`;
    case 'protein_below_floor':
      return `El mínimo de proteína para tu peso son ${Math.ceil(violation.floor)} g al día.`;
  }
}

// --- Controller ---------------------------------------------------------------

export const ProfileController = {
  /** One round trip's worth of everything the profile and dashboard screens need. */
  async getFullProfile(userId: string, locale: string | null = null): Promise<FullProfileView> {
    // Hoisted out of the batch below because the rest of it needs the answer:
    // free-text allergies name the ingredient they resolved to, and that name has
    // a language. One extra sequential read on a screen that already does nine.
    const profile = await ProfileRepository.findByUserId(userId);
    const effectiveLocale = locale ?? profile?.locale ?? FALLBACK_LOCALE;

    const [goal, preferences, dietaryPatterns, foodPreferences, cuisines, allergies, intolerances, customAllergens, override, latestWeightKg, matchable] = await Promise.all([
      ProfileRepository.findActiveGoal(userId),
      ProfileRepository.findPreferences(userId),
      ProfileRepository.findDietaryPatterns(userId),
      ProfileRepository.findFoodPreferences(userId),
      ProfileRepository.findCuisines(userId),
      SafetyRepository.findAllergies(userId),
      SafetyRepository.findIntolerances(userId),
      SafetyRepository.findCustomAllergens(userId, effectiveLocale),
      ProfileRepository.findTargetOverride(userId),
      ProgressRepository.findLatestWeight(userId),
      // The same list the free-text allergy matcher reads; the dislike rule needs
      // exactly it, and one query serves both.
      SafetyRepository.listMatchableIngredients()
    ]);

    const input = targetInput(profile, goal, preferences, latestWeightKg);

    return {
      allergies: allergies.map(a => ({
        allergenId: a.allergenId,
        allergenLabel: a.allergenLabel,
        crossContaminationSensitive: a.crossContaminationSensitive,
        severity: a.severity
      })),
      cuisines,
      customAllergens: customAllergens.map(entry => ({ ingredientId: entry.ingredientId, ingredientName: entry.ingredientName, label: entry.label })),
      dietaryPatterns,
      // Resolved on read, not stored: the catalogue grows, and a label that named
      // nothing last month can name something today.
      foodPreferences: foodPreferences.map(item => ({
        ...item,
        enforced: item.sentiment === 'disliked' && isEnforceableDislike(item.label, matchable)
      })),
      goal: goal ? presentGoal(goal) : null,
      intolerances: intolerances.map(i => ({ allergenId: i.allergenId, allergenLabel: i.allergenLabel })),
      preferences: preferences ? presentPreferences(preferences) : null,
      profile: profile ? presentProfile(profile) : null,
      targets: input ? resolveTargets(input, override ?? null) : null
    };
  },

  async getProfile(userId: string): Promise<ProfileView> {
    const profile = await ProfileRepository.findByUserId(userId);

    if (!profile) {throw new NotFoundError('Profile not found');}

    return presentProfile(profile);
  },

  /**
   * Marks the tour shown, or asks for it again (`0038`).
   *
   * A timestamp rather than a flag, because "when" answers a question a flag
   * cannot: whether somebody saw the tour before or after the thing it now
   * describes existed.
   */
  async setTourSeen(userId: string, seen: boolean): Promise<void> {
    await ProfileRepository.setTourSeen(userId, seen);
  },

  async updateGoal(userId: string, input: UpdateGoal): Promise<GoalView> {
    return presentGoal(await ProfileRepository.upsertGoal(userId, input));
  },

  async updatePreferences(userId: string, input: UpdatePreferences): Promise<PreferencesView> {
    return presentPreferences(await ProfileRepository.upsertPreferences(userId, input));
  },

  async updateProfile(userId: string, input: UpdateProfile): Promise<ProfileView> {
    return presentProfile(await ProfileRepository.upsert(userId, input));
  },

  /**
   * Records the user's own targets, or refuses and says which bound it hit.
   *
   * The refusal runs against the *same* bounds the calculator obeys — one
   * `targetViolations`, one `targetBounds` — so there is no version of this
   * product where a hand-typed number may go where a computed one may not.
   *
   * The candidate is assembled by `resolveTargets` before it is judged, because
   * a correction to calories alone re-derives its macros: judging the raw patch
   * would reject a perfectly coherent request for having only one field.
   */
  async updateTargets(userId: string, patch: UpdateTargetOverride): Promise<ResolvedTargets> {
    const [profile, goal, preferences, latestWeightKg] = await Promise.all([
      ProfileRepository.findByUserId(userId),
      ProfileRepository.findActiveGoal(userId),
      ProfileRepository.findPreferences(userId),
      ProgressRepository.findLatestWeight(userId)
    ]);

    const input = targetInput(profile, goal, preferences, latestWeightKg);

    if (!input) {throw new NotFoundError('Profile not found');}

    const stored = await ProfileRepository.findTargetOverride(userId);
    const candidate = resolveTargets(input, {
      carbsG: merge(patch.carbsG, stored?.carbsG),
      fatG: merge(patch.fatG, stored?.fatG),
      kcal: merge(patch.kcal, stored?.kcal),
      overriddenAt: new Date(),
      proteinG: merge(patch.proteinG, stored?.proteinG)
    });

    if (candidate.overrideViolations.length > 0) {
      throw new InputParseError('Targets out of bounds', { targets: candidate.overrideViolations.map(explain) });
    }

    const saved = await ProfileRepository.upsertTargetOverride(userId, patch);

    return resolveTargets(input, saved);
  }
};
