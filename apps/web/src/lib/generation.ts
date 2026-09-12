import type { Dictionary } from '../i18n/dictionaries/es-ES';

/**
 * Copy for a generation job's outcome.
 *
 * The API records a stable code on the job; this is the only place it becomes a
 * sentence, in whatever language the reader has. `GENERATION_POOL_TOO_SMALL` gets
 * its own explanation on purpose — with `AI_PROVIDER=stub` and an empty recipe
 * library it is the *expected* result, not a malfunction, and a generic "something
 * went wrong" would send someone hunting a bug that isn't there.
 */
export type GenerationCopy = { readonly body: string; readonly canRetry: boolean; readonly title: string };

/**
 * Retryability is a property of the failure, not of the language, so it lives
 * here rather than in the dictionaries — where a translator could accidentally
 * change what a button does.
 */
const CAN_RETRY: Record<string, boolean> = {
  GENERATION_ABANDONED: true,
  GENERATION_AI_UNAVAILABLE: true,
  GENERATION_FAILED: true,
  GENERATION_INVALID_PLAN: true,
  GENERATION_ONBOARDING_INCOMPLETE: false,
  GENERATION_POOL_TOO_SMALL: true,
  GENERATION_PROFILE_INCOMPLETE: false,
  GENERATION_TIMED_OUT: true,
  GENERATION_UNSAFE_CONTENT: true
};

export function generationError(code: string | null, dictionary: Dictionary): GenerationCopy {
  const g = dictionary.generation;
  const copy: Record<string, { body: string; title: string }> = {
    GENERATION_ABANDONED: { body: g.abandonedBody, title: g.abandonedTitle },
    GENERATION_AI_UNAVAILABLE: { body: g.aiUnavailableBody, title: g.aiUnavailableTitle },
    GENERATION_FAILED: { body: g.failedBody, title: g.failedTitle },
    GENERATION_INVALID_PLAN: { body: g.invalidPlanBody, title: g.invalidPlanTitle },
    GENERATION_ONBOARDING_INCOMPLETE: { body: g.onboardingIncompleteBody, title: g.onboardingIncompleteTitle },
    GENERATION_POOL_TOO_SMALL: { body: g.poolTooSmallBody, title: g.poolTooSmallTitle },
    GENERATION_PROFILE_INCOMPLETE: { body: g.profileIncompleteBody, title: g.profileIncompleteTitle },
    GENERATION_TIMED_OUT: { body: g.timedOutBody, title: g.timedOutTitle },
    GENERATION_UNSAFE_CONTENT: { body: g.unsafeBody, title: g.unsafeTitle }
  };

  const known = code === null ? undefined : copy[code];

  return { ...(known ?? { body: g.failedBody, title: g.failedTitle }), canRetry: code === null ? true : (CAN_RETRY[code] ?? true) };
}

/**
 * Machine tokens the API sends, turned into words.
 *
 * The fallback returns the token itself rather than a blank: a slot we have not
 * translated should look like a missing translation, not like an empty row.
 */
export function slotLabel(slot: string, dictionary: Dictionary): string {
  return (dictionary.slots as Record<string, string>)[slot] ?? slot;
}

export function categoryLabel(category: string, dictionary: Dictionary): string {
  return (dictionary.categories as Record<string, string>)[category] ?? category;
}

export function difficultyLabel(difficulty: string, dictionary: Dictionary): string {
  return (dictionary.meal.difficulty as Record<string, string>)[difficulty] ?? difficulty;
}

/** A pipeline stage code, turned into a sentence. Unknown codes show as themselves. */
export function stepLabel(step: string, dictionary: Dictionary): string {
  return (dictionary.generation.steps as Record<string, string>)[step] ?? step;
}
