import { Close, Content, Description, Overlay, Portal, Root, Title, Trigger } from '@radix-ui/react-dialog';

import styles from './Dialog.module.css';

import type { DialogProps as RadixDialogProps } from '@radix-ui/react-dialog';
import type { ReactElement, ReactNode } from 'react';

export interface DialogProps extends RadixDialogProps {
  /** Dialog body. */
  children: ReactNode;
  /** **Required.** Element that closes the dialog — must carry its own accessible name (e.g. `<Button aria-label="Close">…</Button>`). */
  closeButton: ReactElement;
  /** Optional descriptive paragraph announced after the title. When omitted, `aria-describedby` is nulled so Radix doesn't warn. */
  description?: string;
  /** **Required.** Plain-text accessible name (set as `aria-labelledby`). String only — no React nodes. */
  title: string;
  /** **Required.** Element that opens the dialog. Wrapped via `Trigger asChild`. */
  trigger: ReactElement;
}

export function Dialog({ children, closeButton, description, title, trigger, ...rest }: DialogProps) {
  return (
    <Root {...rest}>
      <Trigger asChild={true}>{trigger}</Trigger>
      <Portal>
        <Overlay aria-hidden={true} className={styles.overlay} style={{ pointerEvents: 'auto' }} />
        <Content className={styles.content} {...(description ? {} : { 'aria-describedby': undefined })}>
          <Close asChild={true}>{closeButton}</Close>
          <Title className={styles.title}>{title}</Title>
          {description ? <Description className={styles.description}>{description}</Description> : null}
          {children}
        </Content>
      </Portal>
    </Root>
  );
}
