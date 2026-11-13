import styles from './LandingPictures.module.css';

import { AfterLoad } from 'components/AfterLoad';
import { DishPicture } from 'components/DishPicture';

import { LANDING_PICTURES_MAX } from 'lib/landingPictures';

import type { LandingPicture } from 'lib/landingPictures';

/**
 * The hero's dish pictures, one to three (project 024 phase 7), under every condition of
 * `docs/legal/2026-11-11-redesign.md` § 2.8:
 *
 * - each tile is `DishPicture`, so its «IA» mark is part of the tile's own element, in the
 *   prerendered HTML, over its top-right corner as visible, named for a screen reader (the tile
 *   is decorative: `alt=""` and the mark's hidden «Imagen generada por IA») — N1, W1;
 * - the tiles sit side by side in a grid, never overlapping or rotated, so nothing covers a
 *   mark at any width — N2; nothing here animates the picture apart from its mark (the frame's
 *   own fade moves both together), and the large one, the likely LCP, is never held back — N3;
 * - the file is the original, in a plain `<img>` with its dimensions: the first requested at
 *   once, the others when near and never before the page has loaded (`AfterLoad`), so they do
 *   not take a slow phone's line from the first — B1, B2;
 * - the caption `landing.heroPicturesNote` is beside them, in the same figure — N5;
 * - no dish name is drawn, so no name can belong to the wrong recipe — W3, P4.
 */
export function LandingPictures({ caption, pictures }: Readonly<{ caption: string; pictures: readonly LandingPicture[] }>) {
  const shown = pictures.slice(0, LANDING_PICTURES_MAX);

  if (shown.length === 0) {
    return null;
  }

  return (
    <figure className={styles.figure} data-ai-generated="true" data-count={shown.length}>
      <div className={styles.tiles}>
        {/* `hero` for every tile: the whole 4:3 plate, and the mark at its full size — a
            `thumb`'s mark shrinks with the screen, and § 2.8 N4 forbids a smaller one. */}
        {shown.map((picture, index) =>
          index === 0 ? (
            <div className={styles.tile} key={picture.recipeId}>
              <DishPicture path={picture.path} priority={true} variant="hero" />
            </div>
          ) : (
            <AfterLoad className={`${styles.tile} ${styles.later}`} key={picture.recipeId}>
              <DishPicture path={picture.path} variant="hero" />
            </AfterLoad>
          )
        )}
      </div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}
