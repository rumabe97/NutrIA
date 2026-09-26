import styles from './DishPicture.module.css';

import { Picture } from 'ui/components/Picture';

import { API_URL } from 'lib/env';

import type { PictureRatio } from 'ui/components/Picture';

/**
 * Where a dish's picture is drawn, and so what shape it takes.
 *
 * The API stores one 960 × 720 WebP per recipe — an overhead shot of a plate,
 * centred — so every crop below keeps the plate:
 *
 * - `thumb`, in a list row: square, the shape a thumbnail beside text reads as.
 *   Always drawn, picture or not, so every row of a day starts its text on the
 *   same line.
 * - `card`, the dashboard's next meal: 16:9, wide enough to be a picture, short
 *   enough that the name is still in the first screen of a phone.
 * - `hero`, the meal's own page: 4:3, the whole image, uncropped.
 */
export type DishPictureVariant = 'card' | 'hero' | 'thumb';

const RATIO: Record<DishPictureVariant, PictureRatio> = { card: '16/9', hero: '4/3', thumb: '1/1' };

interface DishPictureProps {
  /** The dish's name when the picture is the content (the meal's page); empty where the name sits beside it. */
  alt?: string;
  /** The recipe's illustration, when one has been drawn: a path on the API, or an absolute URL. */
  path?: string | null;
  /** Above the fold: requested at once instead of when scrolled near. */
  priority?: boolean;
  variant: DishPictureVariant;
}

/** Relative to the API today; an absolute address (a file host) is taken as it is. */
function source(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}

/**
 * A dish's illustration, in a box that holds its shape.
 *
 * A plain `<img>` of the API's own file: the API already serves a phone-sized,
 * immutable WebP, and `next/image` would add an optimiser hop and per-image
 * billing for nothing. The frame (`ui/components/Picture`) reserves the space
 * before a byte arrives and turns a missing or failed picture — offline, the
 * worker keeps no images — into a quiet plate, never a broken icon.
 */
export function DishPicture({ alt = '', path = null, priority = false, variant }: DishPictureProps) {
  return (
    <Picture
      alt={alt}
      className={styles[variant]}
      fallback={
        <svg className={styles.glyph} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5.5" />
        </svg>
      }
      fetchPriority={priority ? 'high' : undefined}
      height={720}
      loading={priority ? 'eager' : 'lazy'}
      ratio={RATIO[variant]}
      src={path ? source(path) : null}
      width={960}
    />
  );
}
