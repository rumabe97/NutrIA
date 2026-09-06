import { Range, Root, Thumb, Track } from '@radix-ui/react-slider';

import styles from './Slider.module.css';

import type { SliderProps as RadixSliderProps } from '@radix-ui/react-slider';

export type SliderProps = RadixSliderProps & {
  /** Per-thumb accessible names (e.g. `['Minimum', 'Maximum']`). For single-thumb sliders, label the Root via `<label>` or `aria-labelledby` instead. */
  ariaLabelThumbs?: string[];
};

export function Slider({ ariaLabelThumbs, className, defaultValue, value, ...rest }: SliderProps) {
  const thumbCount = (value ?? defaultValue)?.length ?? 1;

  return (
    <Root className={className ? `${styles.root} ${className}` : styles.root} defaultValue={defaultValue} value={value} {...rest}>
      <Track className={styles.track}>
        <Range className={styles.range} />
      </Track>
      {Array.from({ length: thumbCount }, (_, i) => (
        <Thumb aria-label={ariaLabelThumbs?.[i]} className={styles.thumb} key={i} />
      ))}
    </Root>
  );
}
