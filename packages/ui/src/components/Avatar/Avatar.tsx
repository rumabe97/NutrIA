import { Root } from '@radix-ui/react-avatar';

import styles from './Avatar.module.css';

import { MarbleEffect } from 'ui/components/MarbleEffect';

import { AvatarFallback } from './components/AvatarFallback';
import { AvatarImage } from './components/AvatarImage';

import type { AvatarProps as RadixAvatarProps } from '@radix-ui/react-avatar';
import type { ReactNode } from 'react';

export interface AvatarProps extends Omit<RadixAvatarProps, 'children'> {
  /** Accessible name (used as `alt` on the image and `aria-label` on the MarbleEffect fallback). Defaults to `name`. */
  alt?: string;
  /** Custom fallback when `src` is missing or fails to load. When provided, you own its a11y. Omit for the default MarbleEffect. */
  fallback?: ReactNode;
  /** **Required.** Seeds the MarbleEffect fallback (same `name` → same marble) and provides the default accessible name. */
  name: string;
  /** Square pixel size. Defaults to 80. */
  size?: number;
  /** Image URL. If missing or fails to load, `fallback` (or the default MarbleEffect) renders instead. */
  src?: string;
}

export function Avatar({ alt, className, fallback, name, size = 80, src, style, ...rest }: AvatarProps) {
  const accessibleName = alt ?? name;

  return (
    <Root className={className ? `${styles.root} ${className}` : styles.root} style={{ height: `${size}px`, width: `${size}px`, ...style }} {...rest}>
      <AvatarImage alt={accessibleName} src={src} />
      <AvatarFallback>{fallback ? fallback : <MarbleEffect aria-label={accessibleName} name={name} size={size} />}</AvatarFallback>
    </Root>
  );
}
