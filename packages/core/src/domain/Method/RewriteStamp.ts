import { isMethodComplete } from './Method';

/**
 * How the rewrite sweep bounds its own retries, using `stepsVersion` — the
 * one per-recipe column it may write without a migration.
 *
 * `stepsVersion` answers "which prompt wrote this method" when a rewrite
 * succeeds. A refusal writes nothing to `instructions` (`RecipeRewriter`
 * never stores what it refuses), so there is nowhere else to remember that it
 * happened — this stamps the current version plus how many refusals already
 * stand against it, read the way semver build metadata is: `2.8.0+2`, the
 * version unchanged and a detail appended. `REWRITE_ATTEMPT_BOUND` refusals
 * against the same version and the sweep stops claiming the recipe — it
 * waits for the standard itself to move (`STEPS_VERSION` bumped, so the base
 * no longer matches) rather than being asked again every day it cannot be
 * fixed.
 */
const ATTEMPT_SEPARATOR = '+';

/** Refusals allowed against one version before the sweep stops claiming a recipe. */
export const REWRITE_ATTEMPT_BOUND = 3;

/** The version a stamp was written against, ignoring any attempt count. `null` in, `null` out. */
export function baseStepsVersion(stepsVersion: string | null): string | null {
  if (stepsVersion === null) {
    return null;
  }

  const at = stepsVersion.indexOf(ATTEMPT_SEPARATOR);

  return at === -1 ? stepsVersion : stepsVersion.slice(0, at);
}

/** How many refusals a bare stamp records, whatever version it names. Zero for anything that names none. */
function attemptsOf(stepsVersion: string | null): number {
  if (stepsVersion === null) {
    return 0;
  }

  const at = stepsVersion.indexOf(ATTEMPT_SEPARATOR);

  if (at === -1) {
    return 0;
  }

  const attempts = Number(stepsVersion.slice(at + 1));

  return Number.isInteger(attempts) && attempts > 0 ? attempts : 0;
}

/**
 * Refusals recorded specifically against `currentVersion` — zero the moment
 * the stamp names a different one. That is what lets a version bump (the
 * standard itself changing) reopen a recipe the sweep had already given up
 * on, rather than carrying an old grudge forward for ever.
 */
export function stepsVersionAttempts(stepsVersion: string | null, currentVersion: string): number {
  return baseStepsVersion(stepsVersion) === currentVersion ? attemptsOf(stepsVersion) : 0;
}

/** What to stamp a recipe with after the sweep refuses its rewrite. */
export function nextRewriteStamp(stepsVersion: string | null, currentVersion: string): string {
  return `${currentVersion}${ATTEMPT_SEPARATOR}${stepsVersionAttempts(stepsVersion, currentVersion) + 1}`;
}

/**
 * Whether the sweep should still claim this recipe: fewer than
 * `REWRITE_ATTEMPT_BOUND` refusals stand against it under `currentVersion`,
 * and either an older prompt wrote its method (or nothing did), or the
 * current one did and the method still has a documentation gap
 * (`isMethodComplete`).
 *
 * `RecipeRepository.claimUndocumented` mirrors exactly this in SQL — a
 * database cannot call a TypeScript function, and the claim has to stay one
 * atomic statement (`FOR UPDATE SKIP LOCKED`) rather than a read-then-write
 * pair that reopens the race two sweeps starting together used to have. This
 * function is the one this project measures the library against and tests
 * against; the SQL is read next to it for the same reason `hasUsableMethod`
 * carries the warning that a second copy of one question has already cost
 * three defects.
 */
export function needsRewrite(
  recipe: { readonly cookMinutes: number; readonly steps: readonly { readonly cue?: string; readonly minutes?: number }[] },
  stepsVersion: string | null,
  currentVersion: string
): boolean {
  if (stepsVersionAttempts(stepsVersion, currentVersion) >= REWRITE_ATTEMPT_BOUND) {
    return false;
  }

  return baseStepsVersion(stepsVersion) !== currentVersion || !isMethodComplete(recipe);
}
