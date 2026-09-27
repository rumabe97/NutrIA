import type { PictureMatch, SeenFood, SeenPicture } from 'core/domain/DishPicture';

/** One judge call's answer, parsed, and what it cost. */
export type JudgeCall<T> = {
  readonly costUsd: number | null;
  readonly model: string;
  /** Whose endpoint answered, as OpenRouter names it. */
  readonly provider: string | null;
  readonly result: T;
};

/** A recipe ingredient as the match call is shown it: recipe data, nothing else. */
export type JudgedIngredient = { readonly name: string; readonly slug: string };

/**
 * The vision judge (`0066`): two calls that report what a picture shows. It
 * decides nothing — `judgePicture` in `core/domain/DishPicture` does, from the
 * catalogue — so a judge that cannot answer is a picture that is not kept.
 */
export abstract class PictureJudgeClient {
  /** False with `AI_PROVIDER=stub` or no `OPENROUTER_IMAGE_API_KEY`. */
  abstract get isAvailable(): boolean;

  /** (a) The picture alone: every food it shows, without knowing what it should show. */
  abstract see(picture: { readonly bytes: Uint8Array; readonly contentType: string }, signal?: AbortSignal): Promise<JudgeCall<SeenPicture>>;

  /** (b) Text alone: the foods seen, matched against the recipe's ingredients. */
  abstract match(seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[], signal?: AbortSignal): Promise<JudgeCall<PictureMatch>>;
}
