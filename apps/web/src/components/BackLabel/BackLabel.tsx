import { Fragment } from 'react';

const ARROW = '←';

/**
 * A «← Clientes» link's words with the arrow hidden from assistive technology:
 * it is the picture of "back", and a screen reader would otherwise read
 * "leftwards arrow" before the destination.
 */
export function BackLabel({ text }: Readonly<{ text: string }>) {
  if (!text.startsWith(ARROW)) {
    return text;
  }

  return (
    <Fragment>
      <span aria-hidden="true">{ARROW}</span>
      {text.slice(ARROW.length)}
    </Fragment>
  );
}
