import { Inject, Injectable, Logger } from '@nestjs/common';

import { isPictureCandidatePath } from 'core/entities/DishPicture';
import { NotFoundError } from 'core/entities/Error';
import { RecipeController } from 'core/controllers/Recipe';

import { PICTURE_CANDIDATE_CLOCK } from '../ai.config.js';
import { PictureCandidateStore } from '../clients/PictureCandidateStore.js';
import { untilAborted } from '../clients/untilAborted.js';

import type { PictureCandidateClock } from '../ai.config.js';

/** How long one call to the private store may take: a file of a few hundred KB, read or deleted. */
const STORE_CALL_MS = 4_000;

/**
 * The rejected pictures that wait for the owner (`0072`): reading one's file,
 * discarding one, and the nightly cleanup of the expired ones. The rules — who
 * may be looked at, in which order a file and its pointer go — are
 * `RecipeController`'s; this holds the private store and hands core the one
 * thing core cannot do, deleting a file.
 *
 * **Nothing here publishes a candidate**, and a candidate's path goes from the
 * row to the store and nowhere else: not into an answer, not into a log line.
 */
@Injectable()
export class PictureCandidatesService {
  private readonly logger = new Logger(PictureCandidatesService.name);

  constructor(
    private readonly store: PictureCandidateStore,
    @Inject(PICTURE_CANDIDATE_CLOCK) private readonly clock: PictureCandidateClock
  ) {}

  /**
   * The nightly cleanup: every candidate that can no longer be looked at has
   * its file deleted and then its pointer removed, which makes its dish
   * claimable again. No deletion starts with less than one store call's time
   * left of `budgetMs`.
   *
   * Without the store — its token removed while dishes still hold a pointer —
   * no file can be deleted, and the pointers are removed all the same: a dish
   * must not wait for ever on a picture nobody can reach. What stays is a
   * private file with no pointer, as after a retry whose deletion failed.
   */
  async clean(budgetMs: number): Promise<{ readonly deleted: number; readonly left: number }> {
    const forget = this.store.isAvailable ? (path: string) => this.forget(path) : () => Promise.resolve();

    return RecipeController.cleanCandidates(forget, { until: new Date(Date.now() + budgetMs - STORE_CALL_MS) }, this.now());
  }

  /** The owner's discard: the file, then the pointer and its audit row. A `NotFoundError` with no candidate to look at. */
  async discard(recipeId: string, actorId: string): Promise<void> {
    this.requireStore();

    await RecipeController.discardCandidate(recipeId, actorId, path => this.forget(path), this.now());
  }

  /**
   * Deletes a candidate's file. What core calls once a pointer is cleared or about to be.
   * A path that is not a candidate's is not ours to delete, whatever the row held: nothing is asked of the store.
   */
  async forget(path: string): Promise<void> {
    if (!isPictureCandidatePath(path)) {
      return;
    }

    const signal = AbortSignal.timeout(STORE_CALL_MS);

    try {
      await untilAborted(this.store.del(path, signal), signal);
    } catch (error: unknown) {
      // The store's own words, already scrubbed of its token and of the path.
      this.logger.warn(`A picture candidate's file was not deleted: ${error instanceof Error ? error.message : 'unknown'}`);

      throw error;
    }
  }

  /** The clock candidates expire by: the same one for the table, the file, the discard and the cleanup. */
  now(): Date {
    return this.clock();
  }

  /**
   * The file of the candidate a dish holds, byte for byte. A `NotFoundError`
   * when there is none to look at — no candidate, an expired one the cleanup
   * has not reached, a file the store no longer has, or no store at all.
   */
  async read(recipeId: string): Promise<Uint8Array> {
    this.requireStore();

    const { candidate } = await RecipeController.pictureCandidate(recipeId, this.now());
    const signal = AbortSignal.timeout(STORE_CALL_MS);
    const bytes = await untilAborted(this.store.get(candidate.path, signal), signal);

    if (bytes === null) {
      throw new NotFoundError('Picture candidate not found');
    }

    return bytes;
  }

  private requireStore(): void {
    if (!this.store.isAvailable) {
      throw new NotFoundError('Picture candidate not found');
    }
  }
}
