import { Fragment } from 'react';

import styles from './ApplianceIcon.module.css';

import type { Appliance } from 'core/entities/Kitchen';

interface ApplianceIconProps {
  appliance: Appliance;
}

/**
 * One appliance, drawn.
 *
 * **It carries no meaning of its own.** The icon is `aria-hidden` and has no
 * title: the appliance's name always sits beside it, and that name is what an
 * assistive technology reads. An icon alone would be a picture nobody can name
 * — and an emoji would be ten different pictures on ten different devices,
 * sized to none of them.
 *
 * Inline, and in `currentColor` at `1em`, so it takes the colour and the size
 * of the text it stands next to — including when the reader has made that text
 * twice as big.
 */
export function ApplianceIcon({ appliance }: ApplianceIconProps) {
  return (
    <svg aria-hidden="true" className={styles.icon} focusable="false" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      {shapeOf(appliance)}
    </svg>
  );
}

/* Stroked geometry only: no fills, so the same path reads on a light and on a dark ground. */
function shapeOf(appliance: Appliance) {
  switch (appliance) {
    case 'air_fryer':
      // A basket drawer with a handle.
      return (
        <Fragment>
          <path d="M5 4h14v11a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V4Z" />
          <path d="M9 9h6" />
          <path d="M5 4h14" />
        </Fragment>
      );

    case 'blender':
      // A tapered jug on a base.
      return (
        <Fragment>
          <path d="M7 4h10l-1.5 11h-7L7 4Z" />
          <path d="M9 18h6" />
          <path d="M10 15v3" />
          <path d="M14 15v3" />
        </Fragment>
      );

    case 'grill':
      // A grate over two flames.
      return (
        <Fragment>
          <path d="M4 10h16" />
          <path d="M4 14h16" />
          <path d="M8 10v4" />
          <path d="M12 10v4" />
          <path d="M16 10v4" />
          <path d="M9 18c0 2 1.5 3 3 3s3-1 3-3" />
        </Fragment>
      );

    case 'microwave':
      // A box with a door and a panel.
      return (
        <Fragment>
          <path d="M3 6h18v12H3V6Z" />
          <path d="M6 9h9v6H6V9Z" />
          <path d="M18 10v4" />
        </Fragment>
      );

    case 'oven':
      // A box with a door handle across it and a window below.
      return (
        <Fragment>
          <path d="M4 4h16v16H4V4Z" />
          <path d="M4 9h16" />
          <path d="M7 12h10v5H7v-5Z" />
          <path d="M7 6.5h4" />
        </Fragment>
      );

    case 'pressure_cooker':
      // A pot with a clamped lid and a valve.
      return (
        <Fragment>
          <path d="M5 8h14v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8Z" />
          <path d="M3 8h18" />
          <path d="M12 8V5" />
          <path d="M10 5h4" />
        </Fragment>
      );

    case 'rice_cooker':
      // A rounded body with a lid and a window.
      return (
        <Fragment>
          <path d="M5 9h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9Z" />
          <path d="M4 9h16" />
          <path d="M8 6h8l1 3H7l1-3Z" />
          <path d="M10 14h4" />
        </Fragment>
      );

    case 'slow_cooker':
      // A wide crock with a handle on each side.
      return (
        <Fragment>
          <path d="M6 9h12v6a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9Z" />
          <path d="M5 9h14" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <path d="M9 6h6" />
        </Fragment>
      );

    case 'steamer':
      // A pot under rising steam.
      return (
        <Fragment>
          <path d="M5 12h14v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4Z" />
          <path d="M4 12h16" />
          <path d="M9 8c1-1 1-2 0-3" />
          <path d="M12 8c1-1 1-2 0-3" />
          <path d="M15 8c1-1 1-2 0-3" />
        </Fragment>
      );

    case 'stovetop':
      // A hob plate with four burners.
      return (
        <Fragment>
          <path d="M4 4h16v16H4V4Z" />
          <circle cx="9" cy="9" r="2" />
          <circle cx="15" cy="9" r="2" />
          <circle cx="9" cy="15" r="2" />
          <circle cx="15" cy="15" r="2" />
        </Fragment>
      );
  }
}
