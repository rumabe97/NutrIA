import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { fitSlots, libraryUsage, SECOND_CUT_SLOTS } from 'core/domain/MealFit';
import { hasUsableMethod } from 'core/domain/Method';
import { rotatePool } from 'core/domain/Variety';
import { bestEffortExclusions, dishSafety, mentionsUnresolvedAllergy } from 'core/domain/Safety';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { ProfileRepository } from '#repositories/Profile';
import { HealthRepository } from '#repositories/Health';
import { proteinSupplementExclusions } from 'core/domain/Health';
import { breaksDishRule, breaksPatternDish, freeFromExclusions, resolvePreferences, withinTime } from 'core/domain/Preference';
import { SafetyController } from 'core/controllers/Safety';
import { SettingsController } from 'core/controllers/Settings';
import { PlanRepository } from '#repositories/Plan';
import { personToday, requireProfileConsent } from 'core/controllers/Profile';
import { AuditRepository } from '#repositories/Audit';
import { NotFoundError, OnboardingIncompleteError, PictureRetryRefusedError, PlanPausedError } from 'core/entities/Error';
import { OnboardingRepository } from '#repositories/Onboarding';
import { VacationRepository } from '#repositories/Vacation';
import { isAway } from 'core/domain/Vacation';
import {
  ACCEPTED_BY_OWNER,
  candidateFlags,
  pictureCandidateOf,
  pictureEvidenceOf,
  repeatsExpiry,
  repeatsFlaggedAllergens
} from 'core/entities/DishPicture';
import { pictureMarks } from 'core/domain/DishPicture';
import { toCatalogue } from 'core/entities/Plan';
import type { CandidateDish, Catalogue, MealSlot, RecipeVerdict } from 'core/entities/Plan';
import type { LibraryUsage } from 'core/domain/MealFit';
import type { Rotation } from 'core/domain/Variety';
import type { RecipeStep } from 'database/schema/recipe';
import type { DishRef, ReusableRecipe, UndocumentedRecipe } from '#repositories/Recipe';

/** Re-exported: a rewriter in `apps/api` needs this shape, and depends on controllers, not repositories. */
export type { UndocumentedRecipe } from '#repositories/Recipe';
import type { PreferenceExclusions } from 'core/domain/Preference';
import type { SafetyProfile } from 'core/entities/Safety';
import type {
  PictureAcceptance,
  PictureCall,
  PictureCandidate,
  PictureJudgedDrawing,
  PictureProvenance,
  PictureReason,
  PictureState
} from 'core/entities/DishPicture';
import type { PictureCatalogueEntry, PictureRecipe } from 'core/domain/DishPicture';

/**
 * How many library recipes to consider per generation — a ceiling on the read,
 * sized well above the library rather than to a sample of it.
 *
 * It was 300, with no order, and that was a sample: once the library passed
 * three hundred Spanish dishes, whichever rows Postgres returned first were the
 * only ones any generation, swap or rebuild could see, and a five-hundred-dish
 * seed would have been mostly invisible. Everything that follows — safety,
 * dislikes, the per-person rotation — filters what this reads, so it has to
 * read all of it. Five hundred recipes and their ingredients are a few
 * thousand rows; the read is not where a generation spends its time.
 */
const REUSE_FETCH_LIMIT = 5000;

/**
 * How long a sweep holds the recipes it took. Longer than a sweep's own 240
 * seconds, so no second sweep takes a recipe the first is still rewriting;
 * short enough that one it could not finish is free again within minutes.
 */
const REWRITE_CLAIM_MINUTES = 5;

/** How long a dish whose drawing failed waits before a view may try again (`0066`, PRD 5). */
export const PICTURE_COOL_OFF_DAYS = 7;

/** How many drawings a dish gets before it fails; the count carries across a stale takeover. */
export const PICTURE_ATTEMPTS = 3;

/** How long a drawing may hold its claim before another view takes it over: longer than the function lives. */
const PICTURE_STALE_MINUTES = 15;

/** How many expired candidates one cleanup takes: far more than a night leaves, and a bound all the same. */
const CANDIDATES_PER_CLEANUP = 100;

/** A drawing this caller won and must now make, or give back. `claimedAt` is the claim's token. */
export type PictureClaim = { readonly attempts: number; readonly claimedAt: Date; readonly recipeId: string };

/** A dish's picture as a screen reads it. A failed drawing reads `none`: the placeholder, and nothing announced. */
export type PictureStatusView = { readonly status: 'drawing' | 'none' | 'ready'; readonly url: string | null };

/** What a screen is told about a stored picture state. */
export function toPictureStatus(state: { readonly status: string | null; readonly url: string | null }): PictureStatusView {
  if (state.status === 'ready' && state.url) {
    return { status: 'ready', url: state.url };
  }

  return { status: state.status === 'drawing' ? 'drawing' : 'none', url: null };
}

/** The first instant of the calendar month `now` falls in, in UTC — where the cap's count starts. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Whether a stored state is one a claim could not take — spared the month's spend read on every view.
 * A row holding a candidate is never claimed (`0072`), cooled off or given back: `claimPicture` refuses it too.
 */
function unclaimable(state: PictureState, now: Date): boolean {
  const since = state.lastAttemptAt === null ? Infinity : now.getTime() - state.lastAttemptAt.getTime();

  return (
    state.status === 'ready' ||
    state.candidate === true ||
    (state.status === 'drawing' && since < PICTURE_STALE_MINUTES * 60_000) ||
    (state.status === 'failed' && state.released !== true && since < PICTURE_COOL_OFF_DAYS * 86_400_000)
  );
}

/**
 * When a candidate stops being reviewable (`0072`): the instant its dish's
 * cool-off ends, `PICTURE_COOL_OFF_DAYS` after the drawing that left it. One
 * clock — "the candidate expires" and "the dish may be drawn again" are the
 * same instant, give or take the nightly cleanup that deletes the file.
 */
export function candidateExpiry(lastAttemptAt: Date): Date {
  return new Date(lastAttemptAt.getTime() + PICTURE_COOL_OFF_DAYS * 86_400_000);
}

/**
 * The candidate a row holds, while it can be looked at: the row is `failed`
 * and `now` is before its expiry. Null otherwise — a candidate the cleanup has
 * not deleted yet is neither shown nor served. Every read of a candidate goes
 * through this, so they cannot disagree.
 */
export function reviewableCandidate(
  row: { readonly lastAttemptAt: Date | null; readonly provenance: PictureProvenance | null; readonly status: string | null },
  now: Date
): { readonly candidate: PictureCandidate; readonly expiresAt: Date } | null {
  if (row.status !== 'failed' || row.lastAttemptAt === null) {
    return null;
  }

  const candidate = pictureCandidateOf(row.provenance);
  const expiresAt = candidateExpiry(row.lastAttemptAt);

  return candidate === null || now.getTime() >= expiresAt.getTime() ? null : { candidate, expiresAt };
}

/** Deletes a candidate's file from the private store. The API's: core names the path and never touches a store. */
export type ForgetCandidateFile = (path: string) => Promise<void>;

/**
 * The two stores as the owner's acceptance needs them (`0072`). The API's:
 * core says what is read, published and deleted, and in which order, and never
 * touches a store. The private store and the public one stay apart — nothing
 * here moves a file between them but `publish`, and only with the bytes it is
 * handed.
 */
export type AcceptanceFiles = {
  /** Whether both stores can be used at all. */
  readonly available: boolean;
  /** Deletes the candidate's file from the private store. */
  readonly forget: ForgetCandidateFile;
  /** Puts these very bytes in the public store, under the usual path with this prompt version, and answers their address. */
  readonly publish: (bytes: Uint8Array, promptVersion: string) => Promise<{ readonly url: string }>;
  /** The candidate's file from the private store, byte for byte, or null when the store no longer has it. */
  readonly read: (path: string) => Promise<Uint8Array | null>;
  /** Deletes from the public store a file this acceptance put there and no row points to. */
  readonly unpublish: (url: string) => Promise<void>;
};

/** The version part of a picture's path: one plain token, so it can never name another folder. */
const PATH_TOKEN = /^[A-Za-z0-9._-]+$/;

export type GenerationContext = {
  readonly catalogue: Catalogue;
  /**
   * Their ways of eating, as stored — the same list `preferences` was resolved
   * from, carried so the meal a dish may be served at is decided for this
   * person (`MealFit`: a vegan or vegetarian sees every plant protein at every
   * meal, `0062` § 4). Read once, here, for the library and the model's dishes
   * alike. Never a prompt line by itself: the prompt names a way of eating only
   * through `NAMEABLE_PATTERNS`.
   */
  readonly dietaryPatterns: readonly string[];
  /** The user's language. Names are resolved into it, reuse is scoped to it, and the model is told to write in it. */
  readonly locale: string;
  /**
   * What their way of eating and their dislikes rule out (0023).
   *
   * Beside `safety` rather than inside it: both remove food before it can be
   * proposed, but one is a constraint and the other a preference, and merging
   * them would report a vegetarian's chicken as an allergy violation.
   */
  readonly preferences: PreferenceExclusions;
  readonly safety: SafetyProfile;
};

/**
 * Whether a dish uses anything this person's way of eating or dislikes rule out
 * (0023), or is foreign to their way of eating by its cuisine or name (`0077`).
 * A recipe already in the library is no more evidence that they want it than
 * that it is safe for them, so reuse is filtered exactly as generation is.
 */
function usesExcluded(
  dish: { readonly cuisine: string | null; readonly ingredients: readonly { readonly slug: string }[]; readonly name: string },
  context: GenerationContext
): boolean {
  const { ingredients } = dish;

  return (
    breaksDishRule(ingredients, context.catalogue, context.preferences) ||
    breaksPatternDish(dish, context.preferences) ||
    ingredients.some(item => {
      const ingredient = context.catalogue.get(item.slug);

      return ingredient !== undefined && context.preferences.excludedIngredientIds.has(ingredient.id);
    })
  );
}

/**
 * Everything a generation needs to reason about food, read for one id. Behind
 * `generationContext`, which adds the consent check, and `nobodysContext`.
 */
async function buildContext(userId: string): Promise<GenerationContext> {
  // Through `SafetyController`, not rebuilt from repositories here. This used
  // to assemble its own profile, which meant "what is this user allowed to
  // eat" had two implementations that happened to agree — until free-text
  // allergies arrived and only one of them knew.
  // The locale comes from the profile, not from a request header: generation
  // runs as a background job, where there is no request to read one from, and
  // a second source would drift from the first.
  const profile = await ProfileRepository.findByUserId(userId);
  const locale = profile?.locale ?? FALLBACK_LOCALE;
  // Same reasoning as the locale, and the same source: a plan is built from
  // what this person can buy, and where they are is a fact about them rather
  // than about the request that happens to trigger the job (`0034`).
  const country = profile?.country ?? null;

  const [catalogue, safety, dietaryPatterns, foodPreferences, preferred, takesProteinSupplement, allergens] = await Promise.all([
    RecipeRepository.loadCatalogue(locale, country),
    SafetyController.getSafetyProfile(userId),
    ProfileRepository.findDietaryPatterns(userId),
    ProfileRepository.findFoodPreferences(userId),
    ProfileRepository.findPreferences(userId),
    HealthRepository.takesProteinSupplement(userId),
    // By key, so a gluten-free or lactose-free way of eating is enforced by
    // the same tags the allergy gate reads, and never named to the model.
    SafetyController.listAllergens()
  ]);

  const allergenIdsByKey = new Map(allergens.map(allergen => [allergen.key, allergen.id]));

  // Resolved here, once, for the same reason the safety profile is: a rule
  // rebuilt at each call site is a rule that disagrees with itself.
  const resolved = resolvePreferences({
    allergenIdsByKey,
    dietaryPatterns,
    dislikedLabels: foodPreferences.filter(item => item.sentiment === 'disliked').map(item => item.label),
    ingredients: catalogue,
    likedLabels: foodPreferences.filter(item => item.sentiment === 'liked').map(item => item.label),
    maxMinutesPerDish: preferred?.cookingTimeMinutes ?? null
  });
  // Protein powder is for the people who take it (`0052`). Excluded the way a
  // dislike is, so the prompt, the library and the gate all agree — and what
  // reaches the model is a catalogue without it, never the supplement.
  const supplements = proteinSupplementExclusions(takesProteinSupplement, catalogue);
  // An allergy the catalogue could not resolve is never named to the model
  // (no free text leaves the building); what shares a word with it is taken
  // out of the catalogue instead, quietly, beside the preferences — never as
  // a safety violation, because it is not a guarantee (`bestEffortExclusions`).
  const unresolvedAllergies = bestEffortExclusions(safety.unenforceableLabels, catalogue);
  // A gluten-free or lactose-free substitute is for the person who needs one
  // (owner, 2026-09-26): excluded the way a dislike is for anybody whose
  // allergies, intolerances and way of eating name no matching restriction, so
  // reuse and the model's catalogue never offer "pan sin gluten" to someone
  // with no reason to want it.
  const freeFrom = freeFromExclusions(catalogue, {
    allergenIdsByKey,
    dietaryPatterns,
    restrictedAllergenIds: new Set([...safety.allergenIds, ...safety.intoleranceAllergenIds])
  });
  const extra = [...supplements, ...unresolvedAllergies, ...freeFrom];
  const preferences = extra.length === 0 ? resolved : { ...resolved, excludedIngredientIds: new Set([...resolved.excludedIngredientIds, ...extra]) };

  return { catalogue: toCatalogue(catalogue), dietaryPatterns, locale, preferences, safety };
}

/**
 * How long the read-back after an acceptance whose transaction threw waits for
 * the row: longer than a commit takes, short enough for a request.
 */
const SETTLED_LOCK_MS = 3_000;

/**
 * Whether a dish's picture is `ready` at this very address, read back after an
 * acceptance whose transaction threw. The read takes the row's lock
 * (`RecipeRepository.settledPicture`), so it waits for a transaction that is
 * still committing and answers what that transaction ended as — true or false
 * is then a fact. Null when the row could not be had in time or read at all:
 * the outcome is unknown.
 */
async function publishedAt(recipeId: string, url: string): Promise<boolean | null> {
  try {
    const row = await RecipeRepository.settledPicture(recipeId, SETTLED_LOCK_MS);

    return row !== null && row.status === 'ready' && row.url === url;
  } catch {
    return null;
  }
}

// --- Presenters ---------------------------------------------------------------

function toCandidateDish(recipe: ReusableRecipe): CandidateDish {
  return {
    cookMinutes: recipe.cookMinutes,
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
    // Copied into mutable arrays: CandidateDish is inferred from a Zod schema,
    // which produces mutable array types.
    ingredients: [...recipe.ingredients],
    name: recipe.name,
    prepMinutes: recipe.prepMinutes,
    servings: recipe.servings,
    slots: [...recipe.mealSlots],
    slug: recipe.slug,
    steps: recipe.steps.map(step => ({ ...step }))
  };
}

// --- Controller ---------------------------------------------------------------

export const RecipeController = {
  /**
   * The owner publishes a candidate against the judge (`picture.accepted`,
   * `0072`) — **the second of the only two doors a picture reaches a person
   * through**; the first is `judgePicture` accepting it, inside a drawing. No
   * retry, cron or automatic code calls this: it takes an admin's session
   * (`actorId`) and the allergens that admin was shown.
   *
   * After the refusals every picture route shares (an unknown recipe, the
   * `dishPictures` switch off, the stores unavailable), six steps, in this
   * order, and the order is the design:
   * 1. the row is `failed`, holds a candidate, and the candidate has not expired;
   * 2. `shown` repeats what the console showed — the second confirmation step,
   *    on the server: the expiry of this very candidate, so a candidate a later
   *    drawing left, which nobody looked at, is never accepted from a page that
   *    shows an older one; and the allergen keys it stores, so what was warned
   *    about is what is accepted;
   * 3. the file is read from the private store and `pictureMarks` runs again on
   *    those bytes — a file that is not a JPEG carrying its C2PA manifest is
   *    never published, whatever the row says it was. As at the judge's door,
   *    what is looked for is that the manifest is there: its signature is not
   *    verified;
   * 4. those same bytes, untouched, are put in the public store, under the
   *    prompt version the candidate was drawn from;
   * 5. one transaction makes the row `ready` — if it is still the row that was
   *    read — and writes the audit row with the overridden allergen keys. What
   *    the judge said is kept beside the owner's marks (`pictureEvidenceOf`: the
   *    rejections' notes and the judged drawings, read with the row in step 1,
   *    which the guarded write proves unchanged); the audit row carries none of
   *    it. When
   *    nothing was updated, or the transaction rolled back, the public file just
   *    written is deleted: a `ready` row always has its audit row, and an audit
   *    row always has its `ready` row. **The file is deleted only once it is
   *    known that no row points to it**: a transaction that threw is read back
   *    under the row's lock, which waits for a commit still in flight; if the
   *    row is `ready` at that address the acceptance happened and goes on; if
   *    the row cannot be had in time, or read at all, the file stays;
   * 6. the private file is deleted, and then its pointer. If that fails the
   *    acceptance stands, and the nightly cleanup finds the row and finishes it.
   *
   * It calls no model, so the month's cap does not hold it. What a person's
   * app then reads is what it reads of any picture: `ready` and an address,
   * and nothing about who accepted it.
   *
   * Refusals are `PictureRetryRefusedError`, and none says what the candidate
   * stores; an unknown recipe, or an id that is not one, is a `NotFoundError`.
   */
  async acceptCandidate(recipeId: string, actorId: string, shown: PictureAcceptance, files: AcceptanceFiles, now: Date = new Date()): Promise<void> {
    if (!z.uuid().safeParse(recipeId).success || !(await RecipeRepository.recipeExists(recipeId))) {
      throw new NotFoundError('Recipe not found');
    }

    if (!(await SettingsController.dishPictures())) {
      throw new PictureRetryRefusedError('flag_off');
    }

    if (!files.available) {
      throw new PictureRetryRefusedError('unavailable');
    }

    // 1. A candidate that can be looked at, by the one clock every read of one uses.
    const row = await RecipeRepository.candidateRow(recipeId);
    const found = row === null ? null : reviewableCandidate(row, now);

    if (row === null || found === null || row.lastAttemptAt === null) {
      throw new PictureRetryRefusedError('no_candidate');
    }

    const { candidate } = found;

    // 2. What the console showed, repeated: this very candidate — not one a later drawing left — and its allergens.
    if (!repeatsExpiry(shown.expiresAt, found.expiresAt)) {
      throw new PictureRetryRefusedError('no_candidate');
    }

    if (!repeatsFlaggedAllergens(shown.allergens, candidate)) {
      throw new PictureRetryRefusedError('allergens_mismatch');
    }

    // 3. The bytes about to be published, checked again: the mark the row stored is not enough.
    const bytes = await files.read(candidate.path);

    if (bytes === null) {
      throw new PictureRetryRefusedError('no_candidate');
    }

    const marks = pictureMarks(bytes);

    if (!marks.jpeg || !marks.c2pa || !PATH_TOKEN.test(candidate.promptVersion)) {
      throw new PictureRetryRefusedError('not_acceptable');
    }

    // 4. The same bytes, in the public store.
    const { url } = await files.publish(bytes, candidate.promptVersion);

    // 5. `ready` and its audit row, together or not at all.
    const allergens = candidateFlags(candidate).allergens;
    let accepted = false;
    let failure: { readonly error: unknown } | null = null;

    try {
      accepted = await RecipeRepository.acceptCandidate(
        recipeId,
        { lastAttemptAt: row.lastAttemptAt, path: candidate.path },
        {
          model: candidate.model,
          promptVersion: candidate.promptVersion,
          provenance: {
            ...pictureEvidenceOf(row.provenance),
            acceptedBy: ACCEPTED_BY_OWNER,
            c2pa: marks.c2pa,
            overriddenAllergens: allergens,
            trainedAlgorithmicMedia: marks.trainedAlgorithmicMedia
          },
          url
        },
        now,
        async tx => {
          await AuditRepository.record({ action: 'picture.accepted', actorId, entity: 'recipe', entityId: recipeId, metadata: { allergens } }, tx);
        }
      );
    } catch (error: unknown) {
      failure = { error };
    }

    if (failure !== null) {
      // A transaction that threw may still have committed — the answer to a COMMIT can be lost on its way back. The
      // row says which, read under its lock so a commit still in flight is waited for: `ready` at this very address
      // is an acceptance that happened, audit row and all.
      const published = await publishedAt(recipeId, url);

      if (published === null) {
        // Nobody can say whether a row points to the file. It stays: a file no row points to harms nobody, and a
        // picture on somebody's screen whose file is gone is the one outcome an acceptance may never produce.
        throw failure.error;
      }

      accepted = published;
    }

    if (!accepted) {
      // No row points to the file: another tab, a retry, a discard or the cleanup moved the row, or the transaction rolled back.
      await files.unpublish(url).catch(() => undefined);

      if (failure !== null) {
        throw failure.error;
      }

      throw new PictureRetryRefusedError('no_candidate');
    }

    // 6. The private file, then its pointer. The picture is published either way; what is left is the cleanup's.
    try {
      await files.forget(candidate.path);
      await RecipeRepository.dropCandidate(recipeId, candidate.path);
    } catch {
      // The `ready` row still holds the pointer, so the nightly cleanup deletes the file and then the pointer.
    }
  },

  /** Every recipe's own method, for `apps/api/scripts/clean-stored-steps.mjs`. See `RecipeRepository.listForStepCleanup`. */
  async allStepsForCleanup(): Promise<
    readonly {
      readonly id: string;
      readonly ingredientSlugs: readonly string[];
      readonly instructions: readonly RecipeStep[];
      readonly locale: string;
      readonly name: string;
    }[]
  > {
    return RecipeRepository.listForStepCleanup();
  },

  /**
   * The catalogue's own slug → display name, lower case, for one locale — the
   * same map `PoolBuilder` builds `cleanSteps`' `ingredientNames` option from.
   * A slug absent here (a food removed from the catalogue since) is left as
   * `cleanStep` leaves any unknown token: untouched.
   */
  async catalogueNames(locale: string): Promise<ReadonlyMap<string, string>> {
    const catalogue = await RecipeRepository.loadCatalogue(locale);

    return new Map(catalogue.map(ingredient => [ingredient.slug, ingredient.name.toLowerCase()]));
  },

  /** Recipes still written by an older prompt, held for this sweep so no other takes them. Bounded. */
  async claimStepUpgrades(stepsVersion: string, limit: number): Promise<readonly UndocumentedRecipe[]> {
    return RecipeRepository.claimUndocumented(stepsVersion, limit, REWRITE_CLAIM_MINUTES);
  },

  /**
   * The nightly cleanup of candidates nobody can look at any more (`0072`):
   * expired, or on a row that is no longer `failed`. For each, `forget` deletes
   * the file and **only then** is the pointer removed — by a write that needs
   * the row to still hold that very path — so a file never outlives the only
   * record of where it is, and the dish is claimable again from that moment.
   * One that fails is left for the next night; none stops the others. No
   * deletion starts once `until` has passed. Returns how many were deleted and
   * how many were left.
   */
  async cleanCandidates(
    forget: ForgetCandidateFile,
    options: { readonly until?: Date } = {},
    now: Date = new Date()
  ): Promise<{ readonly deleted: number; readonly left: number }> {
    const expiredAt = new Date(now.getTime() - PICTURE_COOL_OFF_DAYS * 86_400_000);
    const rows = await RecipeRepository.unreviewableCandidates(expiredAt, CANDIDATES_PER_CLEANUP);
    let deleted = 0;

    for (const row of rows) {
      if (options.until !== undefined && Date.now() >= options.until.getTime()) {
        break;
      }

      try {
        await forget(row.path);

        if (await RecipeRepository.dropCandidate(row.recipeId, row.path)) {
          deleted += 1;
        }
      } catch {
        // The pointer stays, so the next night finds the file again.
      }
    }

    return { deleted, left: rows.length - deleted };
  },

  /**
   * The drawing ended with a picture stored at `url`. False when the claim was no longer this drawing's.
   * `judged` is what the judge answered on this drawing's attempts, kept beside the earlier drawings'.
   */
  async completePicture(
    claim: PictureClaim,
    picture: {
      readonly attempts: number;
      readonly judged: PictureJudgedDrawing | null;
      readonly model: string;
      readonly promptVersion: string;
      readonly provenance: PictureProvenance;
      readonly url: string;
    }
  ): Promise<boolean> {
    return RecipeRepository.completePicture(claim.recipeId, claim.claimedAt, picture);
  },

  /**
   * The owner discards a dish's candidate (`picture.discarded`, `0072`):
   * `forget` deletes the file, then the pointer is removed and the audit row
   * written in one transaction. Nothing else about the dish changes — it stays
   * failed and waits out the same cool-off; the retry is a different verb, and
   * the one that spends.
   *
   * A `NotFoundError` when there is no candidate that can be looked at: an
   * unknown recipe or an id that is not one, no candidate, an expired one, or
   * one that went between the read and the write (another tab, a retry). A
   * deletion that fails throws, and the pointer stays.
   */
  async discardCandidate(recipeId: string, actorId: string, forget: ForgetCandidateFile, now: Date = new Date()): Promise<void> {
    const { candidate } = await RecipeController.pictureCandidate(recipeId, now);

    await forget(candidate.path);

    const dropped = await RecipeRepository.dropCandidate(recipeId, candidate.path, async tx => {
      await AuditRepository.record({ action: 'picture.discarded', actorId, entity: 'recipe', entityId: recipeId, metadata: {} }, tx);
    });

    if (!dropped) {
      throw new NotFoundError('Picture candidate not found');
    }
  },

  /** The drawing ended with nothing kept; the cool-off starts `now`. What its attempts were judged is kept, as `completePicture` keeps it. */
  async failPicture(
    claim: PictureClaim,
    outcome: { readonly attempts: number; readonly judged: PictureJudgedDrawing | null; readonly provenance: PictureProvenance },
    now: Date = new Date()
  ): Promise<boolean> {
    return RecipeRepository.failPicture(claim.recipeId, claim.claimedAt, outcome, now);
  },

  /**
   * Everything a generation needs to reason about food: the catalogue, and the
   * user's safety profile as sets.
   *
   * Loaded once and threaded down. Fourteen days of meals is thousands of allergen
   * lookups, and a profile re-fetched inside that loop is how a check becomes
   * something someone later decides to skip "for performance".
   */
  async generationContext(userId: string): Promise<GenerationContext> {
    const context = await buildContext(userId);

    // Asked *after* the reads, and that order is the point: a withdrawal
    // deletes the allergies and the consent in one transaction, so a context
    // read after it committed is always followed by a check that sees no
    // consent. Asked before, a withdrawal landing between the two would hand a
    // generation an empty safety profile. The one door generation, swaps and
    // the event rebuild all pass through.
    await requireProfileConsent(userId);

    // And a finished profile, read after the same reads for the same reason:
    // a withdrawal reopens the allergy step, and a consent given again before
    // it is answered would otherwise hand any path without its own onboarding
    // check — a professional's swap on a plan under review — an empty safety
    // profile.
    if (!(await OnboardingRepository.find(userId))?.completedAt) {
      throw new OnboardingIncompleteError();
    }

    return context;
  },

  /**
   * Which ingredients the library cooks each of these meals from, for this
   * person — the first of the three things `0063`'s second cut keeps. Only
   * lunch and dinner are cut, so only they are read; a request for neither
   * reads nothing.
   *
   * Every recipe is narrowed with `fitSlots` for this person before it counts
   * (`MealFit.libraryUsage`), never taken at its stored meals.
   */
  async libraryUsage(slots: readonly MealSlot[], context: GenerationContext): Promise<LibraryUsage> {
    const cut = slots.filter(slot => SECOND_CUT_SLOTS.has(slot));

    if (cut.length === 0) {
      return new Map();
    }

    const recipes = await RecipeRepository.findLibraryUsage(cut);

    return libraryUsage(recipes, cut, context.catalogue, context.dietaryPatterns);
  },

  /**
   * Every food the catalogue knows, by name, in one language — what a rewritten
   * method is read against, so that it names no food its dish does not contain.
   */
  async methodVocabulary(locale: string): Promise<readonly string[]> {
    const catalogue = await RecipeRepository.loadCatalogue(locale);

    return catalogue.map(ingredient => ingredient.name);
  },

  /**
   * The context of nobody: a random id that names no account, so no profile,
   * no allergy and no consent — reference data only. For
   * `apps/api/scripts/evaluate-plans.mjs`, which lays synthetic profiles over
   * it and never writes. Never call it with a person in mind.
   */
  async nobodysContext(): Promise<GenerationContext> {
    return buildContext(randomUUID());
  },

  /**
   * The candidate a dish holds, while it can be looked at (`reviewableCandidate`),
   * for the API to fetch its file. It carries the file's path: **for the API's
   * own use, never for an answer**. A `NotFoundError` with a fixed message
   * otherwise — an unknown recipe, an id that is not one, no candidate, or an
   * expired one the cleanup has not deleted yet.
   */
  async pictureCandidate(recipeId: string, now: Date = new Date()): Promise<{ readonly candidate: PictureCandidate; readonly expiresAt: Date }> {
    const row = z.uuid().safeParse(recipeId).success ? await RecipeRepository.candidateRow(recipeId) : null;
    const found = row === null ? null : reviewableCandidate(row, now);

    if (found === null) {
      throw new NotFoundError('Picture candidate not found');
    }

    return found;
  },

  /**
   * What a dish's picture is drawn and judged from (`0066`): the recipe's own
   * data for the prompt, and the **whole** catalogue for the allergen rule,
   * with what each ingredient may contain. Null for a recipe that does not
   * exist. Nothing about any person is read.
   */
  async pictureInputs(recipeId: string): Promise<{ readonly catalogue: readonly PictureCatalogueEntry[]; readonly recipe: PictureRecipe } | null> {
    const [recipe, catalogue] = await Promise.all([RecipeRepository.pictureRecipe(recipeId), RecipeRepository.pictureCatalogue()]);

    return recipe ? { catalogue, recipe } : null;
  },

  /** What the pictures have cost this calendar month, in dollars. */
  async pictureSpendUsd(now: Date = new Date()): Promise<number> {
    return RecipeRepository.monthSpendUsd(monthStart(now));
  },

  /**
   * A dish's picture for somebody polling it: only a dish on one of their own
   * plans, anything else a 404 like every denial. Reads; never starts a drawing.
   */
  async pictureStatus(userId: string, recipeId: string): Promise<PictureStatusView> {
    if (!(await PlanRepository.servesRecipe(userId, recipeId))) {
      throw new NotFoundError('Recipe not found');
    }

    return toPictureStatus(await RecipeRepository.pictureState(recipeId));
  },

  /** One paid call, with what it cost. */
  async recordPictureCall(call: PictureCall): Promise<void> {
    await RecipeRepository.recordPictureCall(call);
  },

  /**
   * One more refusal recorded against `stepsVersion`, so the sweep
   * eventually stops asking. See `RecipeRepository.recordRewriteRefusal`.
   */
  async recordRewriteRefusal(recipeId: string, stepsVersion: string): Promise<void> {
    await RecipeRepository.recordRewriteRefusal(recipeId, stepsVersion);
  },

  /**
   * The drawing stopped for a reason that is not the dish's (the cap, the key):
   * no picture, claimable again at once, keeping the `attempts` already used.
   */
  async releasePicture(
    claim: PictureClaim,
    outcome: { readonly attempts: number; readonly judged: PictureJudgedDrawing | null; readonly reason: PictureReason; readonly why: string },
    now: Date = new Date()
  ): Promise<boolean> {
    return RecipeRepository.releasePicture(claim.recipeId, claim.claimedAt, outcome, now);
  },

  /**
   * The owner takes back a published picture (`picture.removed`, `0072`):
   * how a mistaken acceptance is undone — **any `ready` picture**, the judge's
   * as much as one accepted by hand (project 010, phase 4: a picture the judge
   * accepted wrongly has a way out that is not a migration). The dish goes back
   * to `failed` with the closed reason `owner_removed` and waits out a whole
   * cool-off from `now`, the audit row written in the same transaction and
   * saying which door the picture had come through (`acceptedBy`: `judge` or
   * `owner`, read from the locked row — never a path, never a model's words).
   * It publishes nothing: removing is never a third door (`0072`).
   *
   * The row first, the public file after: from the moment the row says
   * removed no screen is given the picture's address, whatever becomes of the
   * file. `unpublish` then deletes it; when that fails the removal stands and
   * `fileDeleted` is false — a file left in the public store that no row
   * points to, for the owner to delete by hand. Never the other way round: a
   * `ready` row whose file is gone is a broken picture on somebody's screen.
   * A candidate the row still held — an acceptance whose last step failed — has
   * its private file deleted too, best effort, as the retry does: when that
   * deletion fails, what is left is a private file nothing points to, the
   * retry's own known and accepted case.
   *
   * It needs neither the `dishPictures` switch nor the month's cap: taking a
   * picture back is always possible. A `PictureRetryRefusedError`
   * (`not_removable`) for a dish with no `ready` picture — `failed`, `drawing`
   * or never drawn — with nothing written; a `NotFoundError` for an unknown
   * recipe, or an id that is not one.
   */
  async removePicture(
    recipeId: string,
    actorId: string,
    files: { readonly forget: ForgetCandidateFile; readonly unpublish: (url: string) => Promise<void> },
    now: Date = new Date()
  ): Promise<{ readonly fileDeleted: boolean }> {
    if (!z.uuid().safeParse(recipeId).success || !(await RecipeRepository.recipeExists(recipeId))) {
      throw new NotFoundError('Recipe not found');
    }

    const removed = await RecipeRepository.removeAcceptedPicture(recipeId, now, async (tx, { acceptedBy }) => {
      await AuditRepository.record({ action: 'picture.removed', actorId, entity: 'recipe', entityId: recipeId, metadata: { acceptedBy } }, tx);
    });

    if (removed === null) {
      throw new PictureRetryRefusedError('not_removable');
    }

    if (removed.candidatePath !== null) {
      // The removal has already cleared the pointer with the rest of what the row stored. A deletion that fails
      // here leaves a private file nothing points to: known and accepted, as after a retry whose deletion failed.
      await files.forget(removed.candidatePath).catch(() => undefined);
    }

    if (removed.url === null) {
      return { fileDeleted: true };
    }

    try {
      await files.unpublish(removed.url);

      return { fileDeleted: true };
    } catch {
      return { fileDeleted: false };
    }
  },

  /**
   * Claims the drawing of a dish's picture, when one should start now
   * (`0066`, PRD 1, 5, 7, 9): the `dishPictures` flag is on, the dish has no
   * picture, nobody is drawing it, it did not fail within the cool-off, and
   * the month's spend is under `capUsd`. Null otherwise, and null for every
   * caller but one when several ask at once — the claim is one statement.
   *
   * The caller that gets a claim must draw, and end it with `completePicture`,
   * `failPicture` or `releasePicture`.
   */
  async requestPicture(recipeId: string, capUsd: number, now: Date = new Date()): Promise<PictureClaim | null> {
    if (!(await SettingsController.dishPictures())) {
      return null;
    }

    if (unclaimable(await RecipeRepository.pictureState(recipeId), now)) {
      return null;
    }

    if ((await RecipeRepository.monthSpendUsd(monthStart(now))) >= capUsd) {
      return null;
    }

    if (!(await RecipeRepository.claimPicture(recipeId, now, PICTURE_COOL_OFF_DAYS, PICTURE_STALE_MINUTES))) {
      return null;
    }

    // A stale takeover has already counted the drawing that never ended.
    const { attempts } = await RecipeRepository.pictureState(recipeId);

    return { attempts, claimedAt: now, recipeId };
  },

  /**
   * The owner's retry of a dish's picture from the console (`picture.retried`).
   * A dish whose picture `failed` — or was given back — is claimed at once, with
   * no cool-off; everything else a view's claim decides still holds: the
   * `dishPictures` flag, the pictures being available at all (`available`, the
   * API's to say), the month's cap, and a drawing in flight is never taken over (one stuck past
   * `PICTURE_STALE_MINUTES` is, as a view's claim would take it).
   * The audit row is written in the claim's own transaction, so a refused retry
   * leaves none. The caller draws the claim it gets back, as a view does.
   *
   * A candidate the dish held is discarded (`0072`), in this order: the checks,
   * the claim — which clears the pointer — and only then `forget` deletes the
   * file. A deletion that fails leaves a private file nothing points to, which
   * is known and accepted; it never undoes the retry.
   *
   * Refusals are `PictureRetryRefusedError`; an unknown recipe, or an id that
   * is not one, is a `NotFoundError` before anything else is looked at.
   */
  async retryPicture(
    recipeId: string,
    actorId: string,
    options: { readonly available: boolean; readonly capUsd: number; readonly forget?: ForgetCandidateFile },
    now: Date = new Date()
  ): Promise<PictureClaim> {
    if (!z.uuid().safeParse(recipeId).success || !(await RecipeRepository.recipeExists(recipeId))) {
      throw new NotFoundError('Recipe not found');
    }

    if (!(await SettingsController.dishPictures())) {
      throw new PictureRetryRefusedError('flag_off');
    }

    if (!options.available) {
      throw new PictureRetryRefusedError('unavailable');
    }

    const state = await RecipeRepository.pictureState(recipeId);

    const staleDrawing =
      state.status === 'drawing' && (state.lastAttemptAt === null || now.getTime() - state.lastAttemptAt.getTime() >= PICTURE_STALE_MINUTES * 60_000);

    if (state.status === 'drawing' && !staleDrawing) {
      throw new PictureRetryRefusedError('drawing');
    }

    if (state.status !== 'failed' && !staleDrawing) {
      throw new PictureRetryRefusedError('not_retryable');
    }

    if ((await RecipeRepository.monthSpendUsd(monthStart(now))) >= options.capUsd) {
      throw new PictureRetryRefusedError('cap_reached');
    }

    const claimed = await RecipeRepository.retryPicture(recipeId, now, PICTURE_STALE_MINUTES, async tx => {
      await AuditRepository.record({ action: 'picture.retried', actorId, entity: 'recipe', entityId: recipeId, metadata: {} }, tx);
    });

    if (!claimed) {
      // Somebody's view or another retry took it between the read and the claim.
      throw new PictureRetryRefusedError('drawing');
    }

    if (claimed.candidatePath !== null) {
      await options.forget?.(claimed.candidatePath).catch(() => undefined);
    }

    return { attempts: 0, claimedAt: now, recipeId };
  },

  /**
   * Dishes from the library this user may safely eat.
   *
   * Every candidate goes through `findSafetyViolations` — the same gate applied to
   * model output. A recipe already existing is not evidence that it is safe for
   * *this* person, and reuse would otherwise be a hole straight past the allergy
   * layer. See `docs/decisions/0006-reuse-before-generating.md`.
   *
   * Dishes referencing an ingredient no longer in the catalogue are dropped: their
   * macros could not be computed, so they cannot be scheduled.
   *
   * With a `rotation`, the library is then narrowed to this user's own pick — see
   * `rotatePool` for why "reuse everything" meant "everyone gets the same plan".
   *
   * Dishes with no method are dropped too, and that gate is the only thing that
   * lets a quality change ever reach an existing user. Reuse is preferred over
   * generation by design ([`0006`](../../../../docs/decisions/0006-reuse-before-generating.md)),
   * so a library built under an older prompt is served back for ever: the first
   * plan generated after prompt 2.1.0 landed was 41 dishes, of which 3 were new.
   * A recipe that never says how to cook it is the one defect worth spending a
   * regeneration on, so it is the one this filter names.
   */
  async reusablePool(slots: readonly MealSlot[], context: GenerationContext, rotation?: Rotation): Promise<readonly CandidateDish[]> {
    const recipes = await RecipeRepository.findReusable(slots, REUSE_FETCH_LIMIT, context.locale);
    const usable = recipes
      .filter(
        recipe =>
          hasUsableMethod(recipe) &&
          dishSafety(recipe.ingredients, context.catalogue, context.safety).kind === 'safe' &&
          !usesExcluded(recipe, context) &&
          !mentionsUnresolvedAllergy(recipe, context.safety.unenforceableLabels) &&
          withinTime(recipe, context.preferences.maxMinutesPerDish)
      )
      // Served only at the meals every ingredient belongs to, for this person
      // (`0062` § 5): a lentil stew stays a lunch and stops being a dinner, and
      // one that belongs nowhere leaves the pool. Before the rotation, so the
      // dozen it picks per slot is counted from what can actually be served
      // there — a dish counted at dinner and then never placed there is one
      // fewer dinner nobody noticed was missing.
      .map(toCandidateDish)
      .map(dish => ({ ...dish, slots: fitSlots(dish, context.catalogue, context.dietaryPatterns) }))
      .filter(dish => dish.slots.length > 0);

    // Without a rotation every user is handed the whole safe library in the same
    // order, and the deterministic scheduler then hands them the same plan. With
    // one, each user gets their own dozen per slot, minus last fortnight's.
    return rotation ? rotatePool(usable, slots, rotation) : usable;
  },

  async rewriteSteps(recipeId: string, steps: readonly RecipeStep[], stepsVersion: string): Promise<void> {
    await RecipeRepository.updateSteps(recipeId, steps, stepsVersion);
  },

  /** `instructions` alone, nothing else about the recipe. See `RecipeRepository.setInstructionsOnly`. */
  async setCleanedSteps(recipeId: string, steps: readonly RecipeStep[]): Promise<void> {
    await RecipeRepository.setInstructionsOnly(recipeId, steps);
  },

  /** Replaces a recipe's method and records which prompt wrote it. Ingredients are never touched. */
  /** A verdict on a recipe that does not exist is a 404, like every other denial. */
  async setVerdict(userId: string, recipeId: string, verdict: RecipeVerdict): Promise<void> {
    /*
     * Paused too (`0032`). A verdict is harmless on its own, but it is one of
     * the three things the plan screen offers and the rule people can hold is
     * "while I am away, my plan does not change". One exception to that is a
     * rule nobody remembers.
     */
    const today = await personToday(userId);

    if ((await VacationRepository.findUpcoming(userId, today)).some(trip => isAway(trip, today))) {
      throw new PlanPausedError();
    }

    if (!(await RecipeRepository.setVerdict(userId, recipeId, verdict))) {
      throw new NotFoundError('Recipe not found');
    }
  },

  async verdictFor(userId: string, recipeId: string): Promise<'disliked' | 'liked' | null> {
    return RecipeRepository.findVerdict(userId, recipeId);
  },

  /** Everything this person has said about dishes, for the next plan to honour. */
  async verdicts(userId: string): Promise<{ readonly disliked: readonly DishRef[]; readonly liked: readonly DishRef[] }> {
    return RecipeRepository.findVerdicts(userId);
  }
};
