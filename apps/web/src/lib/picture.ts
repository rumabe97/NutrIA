import { API_URL } from './env';

import type { PictureStatusView } from 'core/controllers/Recipe';

/** How often a meal page asks whether its dish's picture is ready (`0066`). */
export const PICTURE_POLL_MS = 4000;

/** How long it keeps asking. A drawing takes seconds; one still going after this is left for the next visit. */
export const PICTURE_POLL_LIMIT_MS = 60_000;

/**
 * Where a dish's picture is loaded from — exactly the address the API gave.
 *
 * The file is Gemini's own JPEG, signed with a C2PA manifest (`0066`): anything
 * that re-encodes it on the way — `next/image`'s optimiser, a resizing CDN — strips
 * the signature that says it was made by AI. So an absolute address (the Blob
 * store's, or the `data:` picture a stub API serves) is used untouched, and only a
 * path on the API is prefixed. The crops are CSS, never a second file.
 */
export function pictureSource(path: string): string {
  return /^(https?:|data:)/.test(path) ? path : `${API_URL}${path}`;
}

type Watch = {
  /** Past this instant (epoch ms) nothing more is asked. */
  readonly deadline: number;
  /** The drawing ended: the ready picture, or null when it failed or the page stopped waiting. */
  readonly onSettled: (ready: PictureStatusView | null) => void;
  /** True while there is no point asking: no connection, or the page is not being looked at. */
  readonly paused: () => boolean;
  readonly read: () => Promise<PictureStatusView>;
};

/**
 * Asks every `PICTURE_POLL_MS` until the picture is ready, the drawing fails or
 * `deadline` passes, and returns the function that stops it — called when the
 * page is left. A failed request is not an answer: the next tick asks again.
 * Paused, a tick asks nothing and the clock keeps running.
 */
export function watchPicture({ deadline, onSettled, paused, read }: Watch): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function settle(ready: PictureStatusView | null) {
    stopped = true;
    onSettled(ready);
  }

  async function tick() {
    if (stopped) {
      return;
    }

    if (Date.now() >= deadline) {
      settle(null);

      return;
    }

    if (!paused()) {
      const view = await read().catch(() => null);

      if (stopped) {
        return;
      }

      if (view?.status === 'ready' && view.url) {
        settle(view);

        return;
      }

      if (view?.status === 'none') {
        settle(null);

        return;
      }
    }

    timer = setTimeout(() => void tick(), PICTURE_POLL_MS);
  }

  timer = setTimeout(() => void tick(), PICTURE_POLL_MS);

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
