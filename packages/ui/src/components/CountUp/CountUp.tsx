'use client';
import { useRef } from 'react';

import styles from './CountUp.module.css';

import { useCountUp } from 'ui/hooks/useCountUp';

import type { ComponentPropsWithRef } from 'react';

export interface CountUpProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  /** How the counting figure is written, as `Intl.NumberFormat` options — serialisable, so a server component can pass it. */
  format?: Intl.NumberFormatOptions;
  /** **Required.** BCP 47 locale the counting figure is written in. */
  locale: string;
  /** The figure as it should finally read, when the caller formats it itself ("1,82 $"). Defaults to `value` formatted. */
  text?: string;
  /** **Required.** The number counted up to. */
  value: number;
}

/**
 * A number that counts up to its value when it arrives (`ui/hooks/useCountUp`).
 *
 * Three layers in one cell: the final text, invisible, which holds the width so nothing beside
 * it moves while the digits grow; the counting figure, hidden from assistive technology; and the
 * final text again for assistive technology, at once and never changing. A screen reader reads
 * the real figure from the first moment; only what is seen moves.
 */
export function CountUp({ className, format, locale, ref, text, value, ...rest }: CountUpProps) {
  const own = useRef<HTMLSpanElement>(null);
  const formatter = new Intl.NumberFormat(locale, format);
  // Always the final value: the counting is written into `own` by the hook, never rendered.
  const settled = useCountUp(value, own, shown => formatter.format(shown));
  const final = text ?? formatter.format(settled);

  return (
    <span className={[styles.root, className].filter(Boolean).join(' ')} ref={ref} {...rest}>
      <span aria-hidden="true" className={styles.sizer}>
        {final}
      </span>
      <span aria-hidden="true" className={styles.figure} ref={own}>
        {final}
      </span>
      <span className="visually-hidden">{final}</span>
    </span>
  );
}
