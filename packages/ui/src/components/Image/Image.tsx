import NXImage from 'next/image';

import styles from './Image.module.css';

import type { ImageProps as NXImageProps } from 'next/image';

export interface ImageProps extends NXImageProps {}

export function Image({ className, ...rest }: ImageProps) {
  return <NXImage className={className ? `${styles.image} ${className}` : styles.image} {...rest} />;
}
