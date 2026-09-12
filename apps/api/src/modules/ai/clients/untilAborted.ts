/**
 * The work, or the signal's abort — whichever settles first. The abandoned
 * work keeps its own handlers, so its late rejection is not an unhandled one.
 *
 * Raced as well as handed to the SDK because on the platform a request ran on
 * past its aborted signal until the function was killed at 300 s (`7d56f3a`):
 * whatever the transport does with the signal, work that outlives its budget
 * is abandoned here, not awaited.
 */
export function untilAborted<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) {
    return work;
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
    };

    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener('abort', abort, { once: true });
    }

    work.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
