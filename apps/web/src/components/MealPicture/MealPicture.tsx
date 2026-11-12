'use client';
import { useEffect, useState } from 'react';

import styles from './MealPicture.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { DishPicture } from 'components/DishPicture';

import { api } from 'lib/api';
import { interpolate } from 'lib/format';
import { PICTURE_POLL_LIMIT_MS, watchPicture } from 'lib/picture';

import type { PictureStatusView } from 'core/controllers/Recipe';
import type { ReactNode } from 'react';

interface MealPictureProps {
  /** Drawn over the picture's foot: the page's strip, with the dish's slot and name. */
  children?: ReactNode;
  name: string;
  /** The picture's address once `status` is `ready`. */
  path: string | null;
  recipeId: string;
  /** The meal's slot: what the dish is drawn as while it has no picture (`lib/dishLook`). */
  slot: string;
  /** `none`: no picture is coming — the designed state, with nothing to caption or wait for. */
  status: 'drawing' | 'none' | 'ready';
  /** The View Transition name the picture shares with the card that opened it. */
  transitionName?: string;
}

/** Not asked while there is no connection, or while nobody is looking at the page. */
function paused(): boolean {
  return !navigator.onLine || document.visibilityState === 'hidden';
}

/**
 * The meal page's picture, the wait for one (`0066`), and the strip laid over its foot.
 *
 * Opening a dish with no picture is what starts its drawing, and the page does
 * not wait for it: it arrives `drawing`, with the dish's designed state in the picture's
 * own box. This asks every few seconds for up to a minute, and swaps the designed state
 * for the picture in the same box — nothing below it moves. Leaving the page stops it;
 * offline or in a hidden tab it asks nothing.
 *
 * The strip (`children`) shares the figure's grid with the picture: the picture spans two
 * rows, the strip sits in the second, over its foot, and the first row never shrinks
 * below the room the «IA» mark needs, so the strip grows the figure downwards rather than
 * covering the mark. The caption stays a visible `<figcaption>` right under the picture and
 * its strip (`docs/legal/dish-pictures.md` § 3.1).
 *
 * Nothing is announced either way. The picture arriving is not news worth
 * interrupting a screen reader for — its name is there for whoever reaches it —
 * and a drawing that failed or took too long leaves the designed state, which is what
 * the page would have shown anyway.
 */
export function MealPicture({ children, name, path, recipeId, slot, status, transitionName }: MealPictureProps) {
  const dictionary = useDictionary();
  const [picture, setPicture] = useState<{ arrived: boolean; path: string | null }>({ arrived: false, path });

  useEffect(() => {
    if (status !== 'drawing') {
      return;
    }

    return watchPicture({
      deadline: Date.now() + PICTURE_POLL_LIMIT_MS,
      onSettled: ready => {
        if (ready) {
          setPicture({ arrived: true, path: ready.url });
        }
      },
      paused,
      read: () => api<PictureStatusView>(`/recipes/${recipeId}/picture-status`)
    });
  }, [recipeId, status]);

  return (
    <figure className={styles.figure} data-bare={picture.path ? undefined : true}>
      {/* Hidden from assistive tech until there is a picture: the designed state is not a
          picture, and an empty stop is noise. A new element when the picture arrives, so
          it fades up over the designed state rather than flashing; reduced motion is
          handled once, in base.css. */}
      <div
        aria-hidden={picture.path ? undefined : true}
        className={`${styles.picture} ${picture.arrived ? 'motion-fade' : ''}`}
        key={picture.arrived ? 'arrived' : 'first'}
      >
        <DishPicture
          alt={interpolate(dictionary.meal.pictureOf, { name })}
          path={picture.path}
          priority={true}
          slot={slot}
          transitionName={transitionName}
          variant="hero"
        />
      </div>
      {children ? <div className={styles.strip}>{children}</div> : null}
      {status === 'none' ? null : <figcaption className={styles.caption}>{dictionary.meal.pictureCaption}</figcaption>}
    </figure>
  );
}
