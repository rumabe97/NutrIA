'use client';
import styles from './DishPicture.module.css';

import { Picture } from 'ui/components/Picture';
import { useDictionary } from 'i18n/LocaleProvider';

import { pictureSource } from 'lib/picture';

import type { PictureRatio } from 'ui/components/Picture';

/**
 * Where a dish's picture is drawn, and so what shape it takes.
 *
 * The API stores one 4:3 picture per recipe — a plate, centred with a margin —
 * so every crop below keeps the plate:
 *
 * - `card`, the dashboard's next meal: 16:9, wide enough to be a picture, short
 *   enough that the name is still in the first screen of a phone.
 * - `hero`, the meal's own page: 4:3, the whole image, uncropped.
 */
export type DishPictureVariant = 'card' | 'hero';

const RATIO: Record<DishPictureVariant, PictureRatio> = { card: '16/9', hero: '4/3' };

interface DishPictureProps {
  /** The dish's name when the picture is the content (the meal's page); empty where the name sits beside it. */
  alt?: string;
  /** The recipe's picture, when one has been drawn: an absolute address, or a path on the API. */
  path?: string | null;
  /** Above the fold: requested at once instead of when scrolled near. */
  priority?: boolean;
  variant: DishPictureVariant;
}

/**
 * A dish's picture, in a box that holds its shape, marked as made by AI.
 *
 * A plain `<img>` of the file exactly as it is served — never `next/image`, never
 * a resize: the file carries Google's C2PA signature, and a re-encode strips it
 * (`0066`). The crops are the frame's `object-fit`. The frame
 * (`ui/components/Picture`) reserves the space before a byte arrives and turns a
 * missing or failed picture — offline, the worker keeps no images — into a quiet
 * plate, never a broken icon.
 *
 * The "IA" mark sits over the top-right corner of every picture shown (AI Act
 * art. 50; `docs/legal/imagenes-de-platos.md` § 3.2): on its own opaque ground so
 * it reads on any photograph, and named in full for a screen reader where the
 * picture itself is decorative, as on the card; a named picture's alt already
 * says it (§ 3.1). The plate has no mark — nothing synthetic is on screen.
 */
export function DishPicture({ alt = '', path = null, priority = false, variant }: DishPictureProps) {
  const dictionary = useDictionary();

  return (
    <span className={`${styles.picture} ${styles[variant]}`}>
      <Picture
        alt={alt}
        className={styles.frame}
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
        src={path ? pictureSource(path) : null}
        width={960}
      />
      {/* Named for a screen reader only where the picture is decorative (the card).
          Where it is named (the meal page) its alt already says "generada por IA",
          and a second notice right after it would be noise. */}
      {path ? (
        <span aria-hidden={alt ? true : undefined} className={styles.mark}>
          <span aria-hidden="true">{dictionary.picture.aiMark}</span>
          {alt ? null : <span className="visually-hidden">{dictionary.picture.aiMarkLabel}</span>}
        </span>
      ) : null}
    </span>
  );
}
