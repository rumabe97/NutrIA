import { Image } from '@radix-ui/react-avatar';

import styles from './AvatarImage.module.css';

import type { AvatarImageProps as RadixAvatarImageProps } from '@radix-ui/react-avatar';

export type AvatarImageProps = RadixAvatarImageProps;

export function AvatarImage({ className, src, ...rest }: AvatarImageProps) {
  return <Image className={className ? `${styles.image} ${className}` : styles.image} src={src} {...rest} />;
}
