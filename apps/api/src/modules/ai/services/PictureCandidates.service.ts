import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { isAnotherRecipesPicture, isPictureCandidatePath, isPublishedPicturePath, PICTURE_FOLDER } from 'core/entities/DishPicture';
import { NotFoundError } from 'core/entities/Error';
import { RecipeController } from 'core/controllers/Recipe';

import { PICTURE_CANDIDATE_CLOCK } from '../ai.config.js';
import { PictureCandidateStore } from '../clients/PictureCandidateStore.js';
import { PictureStore } from '../clients/PictureStore.js';
import { untilAborted } from '../clients/untilAborted.js';

import type { PictureAcceptance } from 'core/entities/DishPicture';
import type { PictureCandidateClock } from '../ai.config.js';

/** How long one call to the private store may take: a file of a few hundred KB, read or deleted. */
const STORE_CALL_MS = 4_000;

/** How long publishing an accepted candidate may take: the same file, written to the public store. */
const PUBLISH_MS = 10_000;

/**
 * The rejected pictures that wait for the owner (`0072`): reading one's file,
 * discarding one, the nightly cleanup of the expired ones — and the owner's
 * acceptance of one, and the removal of a picture accepted so. The rules — who
 * may be looked at, in which order a file and its pointer go, the six steps of
 * an acceptance — are `RecipeController`'s; this holds the two stores and hands
 * core the things core cannot do: reading, writing and deleting a file.
 *
 * **One thing here publishes a candidate: `accept`, the owner's hand** — the
 * second of the two doors a picture reaches a person through; the first is the
 * judge's acceptance inside a drawing (`DishPictureService`). Nothing else
 * does: not the read, the discard or the cleanup, and no retry, cron or
 * automatic code calls `accept`. The two stores stay apart, each on its own
 * token: a candidate's bytes are written to the public store in `publish`,
 * after core has seen that they carry their C2PA manifest, and nowhere else. A candidate's
 * path goes from the row to the private store and nowhere else: not into an
 * answer, not into a log line.
 */
@Injectable()
export class PictureCandidatesService {
  private readonly logger = new Logger(PictureCandidatesService.name);

  constructor(
    private readonly store: PictureCandidateStore,
    private readonly published: PictureStore,
    @Inject(PICTURE_CANDIDATE_CLOCK) private readonly clock: PictureCandidateClock
  ) {}

  /**
   * The owner's acceptance of a dish's candidate against the judge
   * (`RecipeController.acceptCandidate`, which holds the six steps and their
   * order, refuses and audits). `shown` is what the console showed and the
   * request repeats — the candidate's expiry and its allergens; `actorId` is the session's. It calls no model and is not
   * held by the month's cap.
   */
  async accept(id: string, actorId: string, shown: PictureAcceptance): Promise<void> {
    // A uuid reads the same in either case and Postgres matches both; the public path takes it lower case only.
    const recipeId = id.toLowerCase();

    await RecipeController.acceptCandidate(
      recipeId,
      actorId,
      shown,
      {
        available: this.store.isAvailable && this.published.isAvailable,
        forget: path => this.forget(path),
        publish: (bytes, promptVersion) => this.publish(recipeId, bytes, promptVersion),
        read: path => this.candidateFile(path),
        unpublish: url => this.unpublish(recipeId, url)
      },
      this.now()
    );
  }

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

  /**
   * The owner takes back a published picture, whichever door it came through
   * (`RecipeController.removePicture`, which refuses a dish with no `ready`
   * picture and audits): the row first, then the public file. `fileDeleted` is false when the file is still in the public store —
   * no screen is given its address any more.
   */
  async remove(id: string, actorId: string): Promise<{ readonly fileDeleted: boolean }> {
    const recipeId = id.toLowerCase();

    return RecipeController.removePicture(
      recipeId,
      actorId,
      { forget: path => this.forget(path), unpublish: url => this.unpublish(recipeId, url) },
      this.now()
    );
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
    const bytes = await this.candidateFile(candidate.path);

    if (bytes === null) {
      throw new NotFoundError('Picture candidate not found');
    }

    return bytes;
  }

  /** A candidate's file from the private store, or null when it has none. A path that is not a candidate's is never asked for. */
  private async candidateFile(path: string): Promise<Uint8Array | null> {
    if (!isPictureCandidatePath(path)) {
      return null;
    }

    const signal = AbortSignal.timeout(STORE_CALL_MS);

    return untilAborted(this.store.get(path, signal), signal);
  }

  /**
   * Step 4 of an acceptance: the bytes core read and checked, put in the
   * public store as they are — the very array, never a copy that went through
   * anything — under the usual path, with the prompt version the candidate was
   * drawn from. The recipe's id and a random part, never a person's: the path
   * is public. A write that fails, or outlasts its budget, is followed by a
   * deletion of whatever may have been written, and throws.
   */
  private async publish(recipeId: string, bytes: Uint8Array, promptVersion: string): Promise<{ readonly url: string }> {
    const path = `${PICTURE_FOLDER}/${recipeId}/${promptVersion}-${randomUUID()}.jpg`;

    if (!isPublishedPicturePath(path)) {
      throw new Error('Picture publish refused: not a dish picture path');
    }

    const signal = AbortSignal.timeout(PUBLISH_MS);

    try {
      return await untilAborted(this.published.put(path, bytes, 'image/jpeg', signal), signal);
    } catch (error: unknown) {
      this.logger.warn(`The accepted picture of recipe ${recipeId} was not published: ${error instanceof Error ? error.message : 'unknown'}`);
      // A write abandoned at its budget may still land: no row will point to it, so it is deleted by its path, best effort.
      await this.unpublish(recipeId, path).catch(() => undefined);

      throw error;
    }
  }

  /**
   * Deletes a file from the public store: a picture the owner removed, or one
   * an acceptance published that no row came to point to. Throws when it could
   * not, so core can say the file is still there. **Only this recipe's own
   * file**: an address under another recipe's folder — whatever this dish's row
   * says — is refused before the store is asked, so taking one dish's picture
   * back can never leave another dish `ready` at a dead address. The removal
   * stands and answers `fileDeleted: false`.
   */
  private async unpublish(recipeId: string, address: string): Promise<void> {
    if (isAnotherRecipesPicture(address, recipeId)) {
      this.logger.warn(`A published picture of recipe ${recipeId} was not deleted: its address is under another recipe's folder`);

      throw new Error('Picture delete refused: another recipe’s picture');
    }

    const signal = AbortSignal.timeout(STORE_CALL_MS);

    try {
      await untilAborted(this.published.del(address, signal), signal);
    } catch (error: unknown) {
      // The recipe and the store's own words, scrubbed of its token. The file is a dish's picture in the public store, under that recipe's folder.
      this.logger.warn(`A published picture of recipe ${recipeId} was not deleted: ${error instanceof Error ? error.message : 'unknown'}`);

      throw error;
    }
  }

  private requireStore(): void {
    if (!this.store.isAvailable) {
      throw new NotFoundError('Picture candidate not found');
    }
  }
}
