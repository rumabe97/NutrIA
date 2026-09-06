import { Fallback } from '@radix-ui/react-avatar';

import styles from './AvatarFallback.module.css';

import type { AvatarFallbackProps as RadixAvatarFallbackProps } from '@radix-ui/react-avatar';

export type AvatarFallbackProps = RadixAvatarFallbackProps;

export function AvatarFallback({ children, className, ...rest }: AvatarFallbackProps) {
  return (
    <Fallback className={className ? `${styles.fallback} ${className}` : styles.fallback} {...rest}>
      {children}
    </Fallback>
  );
}
