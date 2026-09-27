'use client';
import { useEffect, useState } from 'react';

import styles from './MealPicture.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { DishPicture } from 'components/DishPicture';

import { api } from 'lib/api';
import { interpolate } from 'lib/format';
import { PICTURE_POLL_LIMIT_MS, watchPicture } from 'lib/picture';

import type { PictureStatusView } from 'core/controllers/Recipe';

interface MealPictureProps {
  name: string;
  /** The picture's address once `status` is `ready`. */
  path: string | null;
  recipeId: string;
  status: 'drawing' | 'ready';
}

/** Not asked while there is no connection, or while nobody is looking at the page. */
function paused(): boolean {
  return !navigator.onLine || document.visibilityState === 'hidden';
}

/**
 * The meal page's picture, and the wait for one (`0066`).
 *
 * Opening a dish with no picture is what starts its drawing, and the page does
 * not wait for it: it arrives `drawing`, with the plate in the picture's own box.
 * This asks every few seconds for up to a minute, and swaps the plate for the
 * picture in the same box — nothing below it moves. Leaving the page stops it;
 * offline or in a hidden tab it asks nothing.
 *
 * Nothing is announced either way. The picture arriving is not news worth
 * interrupting a screen reader for — its name is there for whoever reaches it —
 * and a drawing that failed or took too long leaves the plate, which is what the
 * page would have shown anyway.
 */
export function MealPicture({ name, path, recipeId, status }: MealPictureProps) {
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
      {/* A new element when the picture arrives, so it rises in rather than
          flashing over the plate; reduced motion is handled once, in base.css. */}
      <div className={picture.arrived ? 'motion-enter' : undefined} key={picture.arrived ? 'arrived' : 'first'}>
        <DishPicture alt={interpolate(dictionary.meal.pictureOf, { name })} path={picture.path} priority={true} variant="hero" />
      </div>
      <figcaption className={styles.caption}>{dictionary.meal.pictureCaption}</figcaption>
    </figure>
  );
}
