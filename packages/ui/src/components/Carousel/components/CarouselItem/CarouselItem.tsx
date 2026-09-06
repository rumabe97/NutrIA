import styles from './CarouselItem.module.css';

import type { ComponentPropsWithRef } from 'react';

export interface CarouselItemProps extends ComponentPropsWithRef<'div'> {
  /** **Required.** Localized per-slide role description (e.g. `'slide'`, `'diapositiva'`). */
  roleDescription: string;
}

export function CarouselItem({ children, className, ref, roleDescription, ...rest }: CarouselItemProps) {
  return (
    <div aria-roledescription={roleDescription} className={className ? `${styles.item} ${className}` : styles.item} ref={ref} role="group" {...rest}>
      {children}
    </div>
  );
}
