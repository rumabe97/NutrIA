import styles from './Section.module.css';

import type { AccessibleName } from 'ui/types/AccessibleName.types';
import type { ComponentPropsWithRef } from 'react';
import type { Size } from 'ui/types/Sizes.types';

type SectionSize = Exclude<Size, 'xs'>;

type SectionOwnProps = {
  /** Vertical-rhythm tier. `sm` / `md` / `lg` (default). Controls `padding-block`. */
  size?: SectionSize;
};

/**
 * DS landmark primitive. Requires `aria-label` or `aria-labelledby` at the type level
 * (via the `AccessibleName` union) — a nameless `<section>` is invisible to landmark navigation.
 */
export type SectionProps = Omit<ComponentPropsWithRef<'section'>, 'aria-label' | 'aria-labelledby'> & SectionOwnProps & AccessibleName;

export function Section({ className, ref, size = 'lg', ...rest }: SectionProps) {
  return <section className={[styles[size], className].filter(Boolean).join(' ')} ref={ref} {...rest} />;
}
