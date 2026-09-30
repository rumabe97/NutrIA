import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { buildPicturePrompt, flaggedExtras, judgePicture, PICTURE_PROMPT_VERSION, pictureMarks } from 'core/domain/DishPicture';
import { PICTURE_ATTEMPTS, RecipeController } from 'core/controllers/Recipe';

import { AI_PICTURE_CAP } from '../ai.config.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { isQuotaExhausted } from '../clients/quota.js';
import { PictureCallError } from '../clients/pictureTransport.js';
import { PictureCandidateStore } from '../clients/PictureCandidateStore.js';
import { PictureImageClient } from '../clients/PictureImageClient.js';
import { PictureJudgeClient } from '../clients/PictureJudgeClient.js';
import { PictureStore } from '../clients/PictureStore.js';
import { untilAborted } from '../clients/untilAborted.js';

import { PICTURE_CANDIDATE_FOLDER, reasonOfCall, reasonOfRejection } from 'core/entities/DishPicture';

import type { PictureCandidate, PictureDiagnostic, PictureReason } from 'core/entities/DishPicture';
import type { PictureClaim } from 'core/controllers/Recipe';
import type { PictureCatalogueEntry, PictureRecipe, PictureVerdict } from 'core/domain/DishPicture';

/** What a picture is billed on Vertex at 1K (`0066`): recorded when OpenRouter never says, so the cap is never undercounted. */
export const IMAGE_COST_FLOOR_USD = 0.0337;

/** Twice what a judge call cost in the pilot: recorded when a judge call's cost is unknown. */
export const JUDGE_COST_FLOOR_USD = 0.001;

/**
 * How long a drawing may run. The function it runs in ends at 300 seconds
 * (`vercel.json`), and a drawing must end its claim before then: a killed one
 * leaves the dish `drawing` until a view takes it over as stale.
 */
const DRAW_BUDGET_MS = 240_000;

/** No attempt starts with less than this left: one attempt is an image and two judge calls, ~25 s in the pilot. */
const ATTEMPT_MIN_MS = 60_000;

/**
 * How long keeping a rejected picture may take (`0072`). Its own clock, after
 * the drawing's: the upload happens once the attempts are over, inside the
 * minute the function keeps past `DRAW_BUDGET_MS`.
 */
const CANDIDATE_BUDGET_MS = 10_000;

/** How a drawing ended. */
export type DrawOutcome = 'accepted' | 'failed' | 'lost' | 'released';

type Inputs = { readonly catalogue: readonly PictureCatalogueEntry[]; readonly recipe: PictureRecipe };

/** A picture the judge rejected, which carried its C2PA manifest: held in memory while the drawing runs, and no longer. */
type Rejected = { readonly bytes: Uint8Array; readonly model: string; readonly verdict: PictureVerdict };

/** An attempt that ended with no picture to look at: a call that broke, or one the account would not pay for. */
type Unjudged = { readonly kind: 'failed' | 'refused'; readonly note: string; readonly reason: PictureReason };

/** One attempt: kept, not kept (count it and go on), or stopped (count it, and no attempt after it can do better). */
type Attempt =
  | {
      readonly bytes: Uint8Array;
      readonly kind: 'accepted';
      readonly marks: ReturnType<typeof pictureMarks>;
      readonly model: string;
      readonly verdict: PictureVerdict;
    }
  | { readonly diagnostic: PictureDiagnostic; readonly kind: 'unkeepable'; readonly note: string; readonly reason: PictureReason }
  | { readonly kind: 'rejected'; readonly note: string; readonly reason: PictureReason; readonly rejected: Rejected }
  | Unjudged;

/**
 * Whether a failed call says the account cannot pay for another (`0066`):
 * OpenRouter's 402 and 429 — a key past its limit, credits spent, a rate limit
 * — or a quota in the provider's own words. The drawing stops without counting
 * against the dish.
 */
export function isRefusal(error: unknown): boolean {
  return (
    (error instanceof PictureCallError && (error.status === 402 || error.status === 429)) ||
    isQuotaExhausted(error) ||
    /key limit/i.test(String(error))
  );
}

/**
 * What a failed call may have cost: nothing when OpenRouter turned it away
 * (4xx), the floor when nobody knows whether the model ran — a timeout, a
 * 5xx, an answer that could not be read.
 */
function failedCallCost(error: unknown, floor: number): number {
  return error instanceof PictureCallError && error.status !== null && error.status >= 400 && error.status < 500 ? 0 : floor;
}

/** The closed reason a failed call ends a drawing with (`PictureReason`): its status when it had one, else its words. */
function reasonOf(error: unknown): PictureReason {
  return reasonOfCall({ message: describe(error), status: error instanceof PictureCallError ? error.status : null });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

/**
 * Draws a dish's picture once a view has claimed it (`0066`, PRD 1, 2, 5, 6, 7).
 *
 * Up to `PICTURE_ATTEMPTS` attempts, counted from the claim's (a stale takeover
 * has already counted the drawing that died). Each attempt, in order:
 * 1. the month's spend against the cap — reached, the claim is given back;
 * 2. the image call, recorded with its cost;
 * 3. the provenance check — a file without its C2PA manifest is never kept,
 *    and another attempt would come back the same, so the dish fails at once;
 * 4. the judge's two calls, each recorded;
 * 5. `judgePicture`, on the whole catalogue: the allergens come from there.
 *
 * Only an accepted picture is published — stored byte for byte in the public
 * store — and only then is the dish `ready`. A judge that fails is a picture
 * that is not kept, never one that is. The account refusing to pay ends the
 * drawing and gives the claim back, so the dish is `none` again and not
 * failed. Everything else that goes wrong fails the dish, which waits out the
 * cool-off.
 *
 * **A rejected picture is kept privately, for the owner to look at** (`0072`,
 * which amends `0066`): the last picture of the drawing that carried its C2PA
 * manifest and that the judge rejected is held in memory and, only if the
 * drawing ends failed, uploaded to the private store (`PictureCandidateStore`)
 * with a pointer in the dish's row. It has no public address, it is never a
 * dish's picture, and **nothing here publishes one** — no attempt, retry or
 * cron. A drawing that is accepted or given back keeps none; a file without its
 * manifest is never kept anywhere, and the row records what it was instead.
 * Without the private store, none of this happens and drawing is as it was.
 */
@Injectable()
export class DishPictureService {
  private readonly logger = new Logger(DishPictureService.name);

  constructor(
    private readonly background: BackgroundTaskService,
    private readonly images: PictureImageClient,
    private readonly judge: PictureJudgeClient,
    private readonly store: PictureStore,
    private readonly candidates: PictureCandidateStore,
    @Inject(AI_PICTURE_CAP) readonly capUsd: number
  ) {}

  /** Whether a picture could be drawn and kept at all: with the flag on and this false, nothing is claimed. */
  get isAvailable(): boolean {
    return this.images.isAvailable && this.judge.isAvailable && this.store.isAvailable;
  }

  /**
   * Draws after the response, kept alive by the platform (`BackgroundTaskService`).
   *
   * `onEnd` is told that the drawing ended, however it ended — kept, failed, given
   * back, lost or thrown. It is the caller's, and what it does is not this module's
   * business: the owner's mail about failed pictures hangs from it, outside the AI
   * module (`health-boundary.spec.ts`). It cannot change the drawing's outcome: what
   * it throws is dropped.
   */
  schedule(claim: PictureClaim, onEnd?: () => Promise<void> | void): void {
    this.background.run(`dish-picture:${claim.recipeId}`, async () => {
      try {
        return await this.draw(claim);
      } finally {
        try {
          await onEnd?.();
        } catch {
          // The drawing has ended and is recorded; whoever listens fails on their own.
        }
      }
    });
  }

  async draw(claim: PictureClaim): Promise<DrawOutcome> {
    const deadline = Date.now() + DRAW_BUDGET_MS;
    let attempts = claim.attempts;
    const notes: string[] = [];
    let reason: PictureReason = 'other';
    // The last picture the judge rejected, and what a file without its manifest was (`0072`).
    let rejected: Rejected | null = null;
    let diagnostic: PictureDiagnostic | null = null;

    try {
      const inputs = await RecipeController.pictureInputs(claim.recipeId);

      if (!inputs) {
        return await this.release(claim, 'the recipe is gone', attempts, 'other');
      }

      const prompt = buildPicturePrompt(inputs.recipe);

      while (attempts < PICTURE_ATTEMPTS && deadline - Date.now() >= ATTEMPT_MIN_MS) {
        // Known, and bounded (phase 3 review, P3): this gates the image call, not the two
        // judge calls after it, and drawings running at once each pass it — so the month
        // can end up to about one attempt (~0.036 $) past the cap per concurrent drawing.
        // The pictures' OpenRouter key carries its own monthly limit as the wall.
        if ((await RecipeController.pictureSpendUsd()) >= this.capUsd) {
          return await this.release(claim, 'the month’s cap is reached', attempts, 'cap_reached');
        }

        attempts += 1;

        const attempt = await this.attempt(claim, inputs, prompt, AbortSignal.timeout(deadline - Date.now()));

        if (attempt.kind === 'accepted') {
          return await this.keep(claim, attempt, attempts, notes);
        }

        notes.push(`${attempts}:${attempt.kind}:${attempt.note}`);
        reason = attempt.reason;

        if (attempt.kind === 'refused') {
          // The refused attempt is not the dish's: it does not count.
          return await this.release(claim, attempt.note, attempts - 1, attempt.reason);
        }

        if (attempt.kind === 'rejected') {
          rejected = attempt.rejected;
        }

        if (attempt.kind === 'unkeepable') {
          diagnostic = attempt.diagnostic;
          break;
        }
      }
    } catch (error: unknown) {
      notes.push(`error:${describe(error)}`);
      reason = reasonOf(error);
      this.logger.warn(`Picture of recipe ${claim.recipeId} failed: ${describe(error)}`);
    }

    // Only here, where the drawing has ended failed: an accepted or given-back one returned above and kept nothing.
    const candidate = rejected === null ? null : await this.keepCandidate(claim, rejected);
    const provenance = { notes, reason, ...(candidate !== null && { candidate }), ...(diagnostic !== null && { diagnostic }) };
    let ended = false;

    try {
      ended = await RecipeController.failPicture(claim, { attempts, provenance });
    } finally {
      if (!ended && candidate !== null) {
        // No row points to the file: the claim was taken over, or the write failed.
        await this.dropCandidate(candidate);
      }
    }

    return ended ? 'failed' : 'lost';
  }

  private async attempt(claim: PictureClaim, inputs: Inputs, prompt: string, signal: AbortSignal): Promise<Attempt> {
    const recipeId = claim.recipeId;
    let drawn;

    try {
      drawn = await this.images.draw(prompt, signal);
    } catch (error: unknown) {
      await RecipeController.recordPictureCall({
        costUsd: failedCallCost(error, IMAGE_COST_FLOOR_USD),
        kind: 'image',
        model: 'image',
        outcome: 'error',
        recipeId
      });

      return { kind: isRefusal(error) ? 'refused' : 'failed', note: describe(error), reason: reasonOf(error) };
    }

    await RecipeController.recordPictureCall({
      costUsd: drawn.costUsd ?? IMAGE_COST_FLOOR_USD,
      kind: 'image',
      model: drawn.model,
      outcome: 'drawn',
      recipeId
    });

    const marks = pictureMarks(drawn.bytes);

    if (drawn.contentType !== 'image/jpeg' || !marks.c2pa) {
      return {
        // The file is dropped here, for good: what it was is all that is kept of it (`0072`).
        diagnostic: { ...marks, contentType: drawn.contentType, size: drawn.bytes.length },
        kind: 'unkeepable',
        note: `no C2PA manifest (${drawn.contentType})`,
        reason: 'no_provenance'
      };
    }

    const verdict = await this.judged(recipeId, inputs, drawn.bytes, signal);

    if ('kind' in verdict) {
      return verdict;
    }

    if (verdict.accepted) {
      return { bytes: drawn.bytes, kind: 'accepted', marks, model: drawn.model, verdict };
    }

    const note = verdict.notes.join(' ');

    return { kind: 'rejected', note, reason: reasonOfRejection(note), rejected: { bytes: drawn.bytes, model: drawn.model, verdict } };
  }

  /** The judge's two calls, each recorded, and the rule on what they saw. A failed call is a picture that is not kept. */
  private async judged(recipeId: string, inputs: Inputs, bytes: Uint8Array, signal: AbortSignal): Promise<PictureVerdict | Unjudged> {
    const record = (costUsd: number | null, model: string, outcome: string) =>
      RecipeController.recordPictureCall({ costUsd: costUsd ?? JUDGE_COST_FLOOR_USD, kind: 'judge', model, outcome, recipeId });

    try {
      const seen = await this.judge.see({ bytes, contentType: 'image/jpeg' }, signal);

      await record(seen.costUsd, seen.model, 'seen');

      const match = await this.judge.match(seen.result.foods, inputs.recipe.ingredients, signal);

      await record(match.costUsd, match.model, 'matched');

      return judgePicture({ catalogue: inputs.catalogue, match: match.result, recipe: inputs.recipe, seen: seen.result });
    } catch (error: unknown) {
      await record(failedCallCost(error, JUDGE_COST_FLOOR_USD), 'judge', 'error');

      return { kind: isRefusal(error) ? 'refused' : 'failed', note: `judge: ${describe(error)}`, reason: reasonOf(error) };
    }
  }

  /** Stores the file as it came and marks the dish `ready`. A store that fails fails the dish: drawing again would pay again. */
  private async keep(
    claim: PictureClaim,
    attempt: Extract<Attempt, { kind: 'accepted' }>,
    attempts: number,
    notes: readonly string[]
  ): Promise<DrawOutcome> {
    // The recipe's id and a random part, never a person's: the path is public.
    const path = `dish-pictures/${claim.recipeId}/${PICTURE_PROMPT_VERSION}-${randomUUID()}.jpg`;
    const { url } = await this.store.put(path, attempt.bytes, 'image/jpeg');
    const provenance = {
      c2pa: attempt.marks.c2pa,
      judge: attempt.verdict.notes,
      notes,
      trainedAlgorithmicMedia: attempt.marks.trainedAlgorithmicMedia
    };
    const ended = await RecipeController.completePicture(claim, {
      attempts,
      model: attempt.model,
      promptVersion: PICTURE_PROMPT_VERSION,
      provenance,
      url
    });

    if (!ended) {
      // Known (phase 3 review, P3): the file stays in Blob with no row pointing to it.
      // Harmless — a public picture of a dish, already paid for — and rare: the claim
      // is taken over only after 15 minutes, well past the 240 s this drawing may run.
      this.logger.warn(`Picture of recipe ${claim.recipeId} was kept at ${path}, but its claim had been taken over`);

      return 'lost';
    }

    return 'accepted';
  }

  /**
   * Uploads a rejected picture to the private store, as it came, and answers
   * the pointer the dish's row will hold: the path, what drew it, and what the
   * judge flagged in closed words — allergen keys and catalogue slugs, never
   * the judge's own (`flaggedExtras`). Null without the store, and null when
   * the upload fails or outlasts its budget: the dish then fails exactly as it
   * would have, with no candidate. It never changes how the drawing ended.
   */
  private async keepCandidate(claim: PictureClaim, rejected: Rejected): Promise<PictureCandidate | null> {
    // Checked again on the bytes about to be uploaded, here at the only `put`: a file without its C2PA manifest is never kept.
    if (!this.candidates.isAvailable || !pictureMarks(rejected.bytes).c2pa) {
      return null;
    }

    // The recipe's id and a random part, as the public path is made; this one never leaves the API.
    const path = `${PICTURE_CANDIDATE_FOLDER}/${claim.recipeId}/${PICTURE_PROMPT_VERSION}-${randomUUID()}.jpg`;
    const signal = AbortSignal.timeout(CANDIDATE_BUDGET_MS);

    try {
      await untilAborted(this.candidates.put(path, rejected.bytes, 'image/jpeg', signal), signal);

      return { extras: flaggedExtras(rejected.verdict), model: rejected.model, path, promptVersion: PICTURE_PROMPT_VERSION };
    } catch (error: unknown) {
      this.logger.warn(`The rejected picture of recipe ${claim.recipeId} was not kept: ${describe(error)}`);

      return null;
    }
  }

  /** Deletes a candidate no row points to. Best effort: what stays is a private file of a few hundred KB, and nothing reads it. */
  private async dropCandidate(candidate: PictureCandidate): Promise<void> {
    const signal = AbortSignal.timeout(CANDIDATE_BUDGET_MS);

    try {
      await untilAborted(this.candidates.del(candidate.path, signal), signal);
    } catch {
      // Known, and accepted (`0072`): an orphan in the private store.
    }
  }

  /** Gives the claim back, keeping the attempts the dish itself used. */
  private async release(claim: PictureClaim, why: string, attempts: number, reason: PictureReason): Promise<DrawOutcome> {
    this.logger.warn(`Picture of recipe ${claim.recipeId} given back: ${why}`);

    return (await RecipeController.releasePicture(claim, { attempts, reason, why })) ? 'released' : 'lost';
  }
}
