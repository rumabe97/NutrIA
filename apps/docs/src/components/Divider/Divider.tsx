import styles from './Divider.module.css';

import type { CSSProperties } from 'react';

interface DividerProps {
  position?: 'bottom' | 'left' | 'right' | 'top';
  style?: CSSProperties;
}

export function Divider({ position = 'bottom', style }: DividerProps) {
  return <div aria-hidden="true" className={styles[position]} style={style} />;
}
