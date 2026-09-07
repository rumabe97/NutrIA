import { Injectable, Logger } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';

/**
 * Runs work that must outlive the response without delaying it.
 *
 * On a serverless platform a function may be frozen the moment its response is
 * sent. A bare `void somePromise()` therefore has no guarantee of completing, and
 * nothing marks its passing: the failure is a suspended process, not a thrown
 * error, so there is no log line and no stack trace — only a row that stays
 * `running` until a sweeper gives up on it.
 *
 * That is not hypothetical here. Plan generation is exactly this shape, and it
 * takes thirty to forty-five seconds of provider round trips after the job id has
 * already been returned to the client.
 *
 * `waitUntil` asks the platform to keep the invocation alive until the work
 * settles. Off-platform it throws, which is caught: the promise is already in
 * flight and a long-running process will let it finish on its own, so local runs
 * and tests behave identically.
 */
@Injectable()
export class BackgroundTaskService {
  private readonly logger = new Logger(BackgroundTaskService.name);

  /**
   * @param label named in the log line if the work rejects, so a failure is
   *   attributable without reading a stack trace through generic plumbing.
   */
  run(label: string, work: (() => Promise<unknown>) | Promise<unknown>): void {
    const promise = typeof work === 'function' ? work() : work;

    // Swallowing here is deliberate: an unhandled rejection would take the whole
    // process down, and every caller of this has already decided that its own
    // failure must not fail the request that started it.
    const guarded = promise.catch((error: unknown) => {
      this.logger.warn(`Background task "${label}" failed: ${error instanceof Error ? error.message : 'unknown'}`);
    });

    try {
      waitUntil(guarded);
    } catch {
      // Not running on the platform. The promise is in flight either way.
    }
  }
}
