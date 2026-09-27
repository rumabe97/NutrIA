'use client';
import { useEffect, useRef, useState } from 'react';

import styles from './Picture.module.css';

import { useComposedRefs } from 'ui/hooks/useComposedRefs';

import type { ComponentPropsWithRef, ReactNode } from 'react';

export type PictureRatio = '1/1' | '16/9' | '4/3';

export interface PictureProps extends Omit<ComponentPropsWithRef<'img'>, 'children' | 'src'> {
  /** Drawn in the middle of the frame when there is no `src` or it fails to load. Decorative: it is hidden from assistive tech. */
  fallback?: ReactNode;
  /** The frame's shape. The image is cropped to it (`object-fit: cover`), centred. Defaults to `4/3`. */
  ratio?: PictureRatio;
  /** Image URL. Missing or failing, the frame stays — same box, `fallback` inside — so nothing around it moves. */
  src?: string | null;
}

/**
 * A plain `<img>` in a frame that holds its shape whatever the image does.
 *
 * The frame is what reserves the space: its `aspect-ratio` is set before a byte
 * arrives, so a slow image cannot push the text beside it, and an image of the
 * wrong shape is cropped to the frame rather than changing it. `width` and
 * `height` still go on the `<img>` as the intrinsic-size hint the browser wants.
 *
 * Loading, the frame shows its own neutral ground. Failing, the `<img>` is
 * removed — never a broken-image icon — and `fallback` is drawn instead, hidden
 * from assistive tech: a placeholder is not a picture, so nothing announces one.
 * Whatever the picture showed is named in the text around it.
 *
 * Not `next/image`, on purpose: this is for images already sized by whoever
 * serves them. `className` and `style` go on the frame; everything else,
 * `ref` included, goes on the `<img>`.
 */
export function Picture({
  alt = '',
  className,
  decoding = 'async',
  fallback,
  loading = 'lazy',
  onError,
  ratio = '4/3',
  ref,
  src,
  style,
  ...rest
}: PictureProps) {
  const inner = useRef<HTMLImageElement>(null);
  const composed = useComposedRefs(inner, ref);
  // Keyed on the address, so a new `src` gets its own chance without an effect to reset it.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src) && failedSrc === src;
  const shown = Boolean(src) && !failed;

  // An image that failed before hydration fired its `error` before React was listening.
  // `complete` with no pixels is that failure; a lazy image not yet requested is not complete.
  useEffect(() => {
    const image = inner.current;

    if (src && image?.complete && image.naturalWidth === 0) {
      setFailedSrc(src);
    }
  }, [src]);

  const classes = className ? `${styles.frame} ${className}` : styles.frame;

  return (
    <span aria-hidden={shown ? undefined : true} className={classes} data-failed={failed || undefined} data-ratio={ratio} style={style}>
      {shown ? (
        <img
          alt={alt}
          className={styles.image}
          decoding={decoding}
          loading={loading}
          onError={event => {
            setFailedSrc(src ?? null);
            onError?.(event);
          }}
          ref={composed}
          src={src ?? undefined}
          {...rest}
        />
      ) : (
        <span aria-hidden="true" className={styles.fallback}>
          {fallback}
        </span>
      )}
    </span>
  );
}
