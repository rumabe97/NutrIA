'use client';
import { Fragment } from 'react';

import { useDictionary } from 'i18n/LocaleProvider';

import type { MacroDirection } from 'core/entities/Event';

/**
 * "hidratos ↑": a macro and which way a loaded day moved it (`0043`).
 *
 * The arrow is the design, and it is also a glyph a screen reader may read as
 * "upwards arrow", or skip at its default punctuation level. So the arrow is
 * hidden from assistive technology and the word it stands for — *más*, *menos*
 * — goes in front of the label where only a screen reader finds it. Sighted
 * readers see `hidratos ↑`; everyone else hears "más hidratos".
 */
export function MacroShift({ direction, label }: { direction: Exclude<MacroDirection, 'same'>; label: string }) {
  const t = useDictionary().events;

  return (
    <Fragment>
      <span className="visually-hidden">{direction === 'up' ? t.more : t.less}</span> {label}{' '}
      <span aria-hidden="true">{direction === 'up' ? '↑' : '↓'}</span>
    </Fragment>
  );
}
