'use client';
import { useEffect, useRef } from 'react';

import styles from './DishActions.module.css';

import type { ReactNode } from 'react';

interface DishActionsProps {
  children: ReactNode;
}

/** The custom property the dish page keeps free at its foot for this bar (`plan/comida/[id]/page.module.css`). */
const BLOCK = '--dish-actions-block';

/**
 * The dish's actions — done, skipped, another dish — held at the foot of a phone's screen,
 * just above the floating bar (`--app-bar-clearance`), so they are at hand wherever the
 * recipe has been scrolled to (project 024 phase 4). From 48rem, where the bar is a rail,
 * they sit in the page beside the picture as before.
 *
 * Fixed, so the page must keep their height free at its end or they would cover the last
 * step: the bar's own height is written to `--dish-actions-block` as it changes — a label
 * wrapping at large text, the "another dish" panel opening — and the page's foot reads it.
 * Before this runs the page keeps a single row's height, which is what the bar is at
 * normal text.
 *
 * The panel that opens from "Cambiar plato" grows the bar upwards; past the screen's room
 * the bar scrolls inside itself, so its last option is never out of reach.
 */
export function DishActions({ children }: DishActionsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const root = document.documentElement;
    const write = () => root.style.setProperty(BLOCK, `${element.offsetHeight}px`);
    const observer = new ResizeObserver(write);

    write();
    observer.observe(element);

    return () => {
      observer.disconnect();
      root.style.removeProperty(BLOCK);
    };
  }, []);

  return (
    <div className={styles.actions} ref={ref}>
      {children}
    </div>
  );
}
