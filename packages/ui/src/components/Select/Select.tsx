import { Content, Portal, Root, Trigger, Value, Viewport } from '@radix-ui/react-select';

import styles from './Select.module.css';

import type { ReactNode } from 'react';
import type { SelectProps as _SelectProps } from '@radix-ui/react-select';

export type SelectProps = _SelectProps & {
  /**
   * `id`s of text that describes the choice — forwarded to the Trigger button,
   * for the same reason the two names are: the Root is not the element a
   * screen reader reads.
   *
   * It exists because of what a disabled option cannot say. Radix skips one
   * with the arrow keys, so a rule about what cannot be chosen — "a day that
   * already holds two fixed meals" — is pointer-only unless it is also on the
   * trigger (`0103`, measured by `warn-a11y` on 2026-10-16).
   */
  'aria-describedby'?: string;
  /** Accessible name — forwarded from Root to the Trigger button (Radix Root isn't labelable). */
  'aria-label'?: string;
  /** `id` of an on-screen label element — forwarded to the Trigger button. Prefer over `aria-label` when a visible label exists. */
  'aria-labelledby'?: string;
  /** Placeholder shown when nothing is selected. Localize in non-English apps. */
  placeholder?: ReactNode;
};

export function Select({ children, placeholder, ...rest }: SelectProps) {
  // Radix Select.Root isn't a labelable element — the Trigger button is what screen
  // readers attach the name to. Forward labeling props from Root to Trigger.
  const ariaLabel = rest['aria-label'];
  const ariaLabelledBy = rest['aria-labelledby'];
  const ariaDescribedBy = rest['aria-describedby'];

  return (
    <Root {...rest}>
      <Trigger aria-describedby={ariaDescribedBy} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className={styles.trigger}>
        <Value className={styles.label} placeholder={placeholder} />
      </Trigger>
      <Portal>
        <Content align="end" className={styles.content} position="popper">
          <Viewport>{children}</Viewport>
        </Content>
      </Portal>
    </Root>
  );
}
