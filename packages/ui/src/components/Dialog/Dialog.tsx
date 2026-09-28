import { Close, Content, Description, Overlay, Portal, Root, Title, Trigger } from '@radix-ui/react-dialog';

import styles from './Dialog.module.css';

import type { DialogContentProps, DialogProps as RadixDialogProps } from '@radix-ui/react-dialog';
import type { ReactElement, ReactNode } from 'react';

export interface DialogProps extends RadixDialogProps {
  /** Dialog body. */
  children: ReactNode;
  /**
   * Element that closes the dialog — must carry its own accessible name (e.g. `<Button aria-label="Close">…</Button>`).
   * Omit it only when the body has its own way out, such as a "Cancel" that sets `open` to false; `Escape` closes either way.
   */
  closeButton?: ReactElement;
  /** Optional descriptive paragraph announced after the title. When omitted, `aria-describedby` is nulled so Radix doesn't warn. */
  description?: string;
  /**
   * Runs as the dialog closes, before focus returns to the trigger. Call `event.preventDefault()` and focus
   * something else when the dialog's own action took the trigger away.
   */
  onCloseAutoFocus?: DialogContentProps['onCloseAutoFocus'];
  /** **Required.** Plain-text accessible name (set as `aria-labelledby`). String only — no React nodes. */
  title: string;
  /** **Required.** Element that opens the dialog. Wrapped via `Trigger asChild`. */
  trigger: ReactElement;
}

export function Dialog({ children, closeButton, description, onCloseAutoFocus, title, trigger, ...rest }: DialogProps) {
  return (
    <Root {...rest}>
      <Trigger asChild={true}>{trigger}</Trigger>
      <Portal>
        <Overlay aria-hidden={true} className={styles.overlay} style={{ pointerEvents: 'auto' }} />
        <Content className={styles.content} onCloseAutoFocus={onCloseAutoFocus} {...(description ? {} : { 'aria-describedby': undefined })}>
          {closeButton ? <Close asChild={true}>{closeButton}</Close> : null}
          <Title className={styles.title}>{title}</Title>
          {description ? <Description className={styles.description}>{description}</Description> : null}
          {children}
        </Content>
      </Portal>
    </Root>
  );
}
