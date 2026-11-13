'use client';
import styles from './DishPicture.module.css';

import { Picture } from 'ui/components/Picture';
import { useDictionary } from 'i18n/LocaleProvider';

import { DishGlyph } from 'components/DishGlyph';

import { dishMoment } from 'lib/dishLook';
import { pictureSource } from 'lib/picture';

import type { CSSProperties } from 'react';
import type { PictureRatio } from 'ui/components/Picture';

/**
 * Where a dish's picture is drawn, and so what shape it takes.
 *
 * The API stores one 4:3 picture per recipe — a plate, centred with a margin —
 * so every crop below keeps the plate:
 *
 * - `card`, Inicio's next meal: 16:9, wide enough to be a picture, short enough
 *   that the name is still in the first screen of a phone.
 * - `hero`, the meal's own page: 4:3, the whole image, uncropped.
 * - `thumb`, a meal's row in a day: 1:1, the plate's middle.
 */
export type DishPictureVariant = 'card' | 'hero' | 'thumb';

/** Where a lighter copy is drawn instead of the original: a phone's width, where the copy's 720 px are enough. */
const LIGHT_MEDIA = '(max-width: 40rem)';

const RATIO: Record<DishPictureVariant, PictureRatio> = { card: '16/9', hero: '4/3', thumb: '1/1' };

interface DishPictureProps {
  /** The dish's name when the picture is the content (the meal's page); empty where the name sits beside it. */
  alt?: string;
  /**
   * A lighter copy of the same picture for a phone, as a path on this site — only the landing's
   * three have one (`lib/landingPictures`, `docs/legal/2026-11-13-lighter-landing-pictures.md`).
   */
  lightPath?: string;
  /** The recipe's picture, when one has been drawn: an absolute address, or a path on the API. */
  path?: string | null;
  /** Above the fold: requested at once instead of when scrolled near. */
  priority?: boolean;
  /** The meal's slot: what a dish with no picture is drawn as (`lib/dishLook`). */
  slot?: string | null;
  /**
   * The View Transition name this picture carries (`dish-<id>`, `ui/styles/motion`), on
   * the dish's own page, where a card that was tapped grows into it.
   */
  transitionName?: string;
  variant: DishPictureVariant;
}

/**
 * A dish's picture, in a box that holds its shape, marked as made by AI — or, with no
 * picture, the dish's designed state: its moment of the day's colour and glyph.
 *
 * A plain `<img>` of the file exactly as it is served — never `next/image`, never
 * a resize on the way: the file carries Google's C2PA signature, and a re-encode strips it
 * (`0066`). The one exception is `lightPath`: a copy made once, by hand, for the landing's
 * three pictures, which a phone is given instead (the legal opinion of 2026-11-13). The crops are the frame's `object-fit`. The frame
 * (`ui/components/Picture`) reserves the space before a byte arrives — `width` and
 * `height` go on the `<img>` too — so nothing moves when it lands, and it turns a
 * missing or failed picture — offline, the worker keeps no images — into the
 * designed state, never a broken icon and never an empty frame.
 *
 * The "IA" mark sits over the top-right corner of every picture shown (AI Act
 * art. 50; `docs/legal/dish-pictures.md` § 3.2): on its own opaque ground so
 * it reads on any photograph, and named in full for a screen reader where the
 * picture itself is decorative, as on a card or a row; a named picture's alt already
 * says it (§ 3.1). The designed state has no mark — nothing synthetic is on screen.
 */
export function DishPicture({ alt = '', lightPath, path = null, priority = false, slot = null, transitionName, variant }: DishPictureProps) {
  const dictionary = useDictionary();
  const moment = dishMoment(slot);
  // The name the page's hero shares with the card that was tapped; a card's own is set
  // only on the one that was tapped, at the moment it is (`components/DishLink`).
  const style: CSSProperties | undefined = transitionName ? { viewTransitionName: transitionName } : undefined;

  return (
    <span className={`${styles.picture} ${styles[variant]}`} data-dish-picture="" style={style}>
      <Picture
        alt={alt}
        className={`${styles.frame} ${styles[moment]}`}
        fallback={<DishGlyph className={styles.glyph} moment={moment} />}
        fetchPriority={priority ? 'high' : undefined}
        height={720}
        loading={priority ? 'eager' : 'lazy'}
        narrow={path && lightPath ? { media: LIGHT_MEDIA, src: lightPath } : undefined}
        ratio={RATIO[variant]}
        src={path ? pictureSource(path) : null}
        width={960}
      />
      {/* Named for a screen reader only where the picture is decorative (a card, a row).
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
