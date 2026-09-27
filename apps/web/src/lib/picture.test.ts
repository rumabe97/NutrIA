import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { PICTURE_POLL_LIMIT_MS, PICTURE_POLL_MS, pictureSource, watchPicture } from './picture';

import type { PictureStatusView } from 'core/controllers/Recipe';

const DRAWING: PictureStatusView = { status: 'drawing', url: null };
const READY: PictureStatusView = { status: 'ready', url: 'https://blob.example/recipes/a.jpg' };

/**
 * The picture is Gemini's file as served: its C2PA signature says it was made by
 * AI, and any re-encode on the way strips it (`0066`).
 */
describe('pictureSource', () => {
  it('uses a Blob address untouched — no optimiser, no query', () => {
    expect(pictureSource(READY.url as string)).toBe(READY.url);
  });

  it('uses a stub data: picture untouched', () => {
    expect(pictureSource('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
  });

  it('puts a path on the API', () => {
    expect(pictureSource('/recipes/a/image')).toMatch(/\/api\/v1\/recipes\/a\/image$/);
  });

  it('is what DishPicture draws, through a plain <img> and never next/image', () => {
    const source = readFileSync(new URL('../components/DishPicture/DishPicture.tsx', import.meta.url), 'utf8');

    expect(source).toContain('pictureSource(');
    expect(source).not.toMatch(/from 'next\/image'|from 'ui\/components\/Image'/);
  });
});

describe('watchPicture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function watch(read: () => Promise<PictureStatusView>, paused = () => false) {
    const onSettled = vi.fn();
    const stop = watchPicture({ deadline: Date.now() + PICTURE_POLL_LIMIT_MS, onSettled, paused, read });

    return { onSettled, stop };
  }

  it('asks every 4 s and hands over the picture once it is ready', async () => {
    const read = vi.fn<() => Promise<PictureStatusView>>().mockResolvedValueOnce(DRAWING).mockResolvedValueOnce(READY);
    const { onSettled } = watch(read);

    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
    expect(read).toHaveBeenCalledOnce();
    expect(onSettled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
    expect(onSettled).toHaveBeenCalledWith(READY);
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS * 3);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('stops quietly when the drawing failed', async () => {
    const read = vi.fn<() => Promise<PictureStatusView>>().mockResolvedValue({ status: 'none', url: null });
    const { onSettled } = watch(read);

    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
    expect(onSettled).toHaveBeenCalledWith(null);
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS * 3);
    expect(read).toHaveBeenCalledOnce();
  });

  it('gives up after 60 s, having asked no more than 15 times', async () => {
    const read = vi.fn<() => Promise<PictureStatusView>>().mockResolvedValue(DRAWING);
    const { onSettled } = watch(read);

    await vi.advanceTimersByTimeAsync(PICTURE_POLL_LIMIT_MS + PICTURE_POLL_MS * 3);
    expect(onSettled).toHaveBeenCalledExactlyOnceWith(null);
    expect(read.mock.calls.length).toBeLessThanOrEqual(PICTURE_POLL_LIMIT_MS / PICTURE_POLL_MS);
  });

  it('keeps asking after a failed request', async () => {
    const read = vi.fn<() => Promise<PictureStatusView>>().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(READY);
    const { onSettled } = watch(read);

    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS * 2);
    expect(onSettled).toHaveBeenCalledWith(READY);
  });

  it('asks nothing while paused (offline, or the tab hidden)', async () => {
    const read = vi.fn<() => Promise<PictureStatusView>>().mockResolvedValue(DRAWING);
    let paused = true;

    watch(read, () => paused);
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS * 3);
    expect(read).not.toHaveBeenCalled();

    paused = false;
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
    expect(read).toHaveBeenCalledOnce();
  });

  it('asks nothing more once stopped — the page was left', async () => {
    const read = vi.fn<() => Promise<PictureStatusView>>().mockResolvedValue(DRAWING);
    const { onSettled, stop } = watch(read);

    await vi.advanceTimersByTimeAsync(PICTURE_POLL_MS);
    stop();
    await vi.advanceTimersByTimeAsync(PICTURE_POLL_LIMIT_MS);
    expect(read).toHaveBeenCalledOnce();
    expect(onSettled).not.toHaveBeenCalled();
  });
});
