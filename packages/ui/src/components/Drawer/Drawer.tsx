'use client';
import styles from './Drawer.module.css';

import { Drawer as VaulDrawer } from 'vaul';

import type { ReactElement, ReactNode } from 'react';

export interface DrawerProps {
  /** Drawer body. */
  children: ReactNode;
  /** Optional descriptive paragraph announced after the title. When omitted, `aria-describedby` is nulled. */
  description?: string;
  /** Controlled open handler. Fires with `true` on trigger, `false` on Escape/overlay/drag-dismiss. Omit for uncontrolled. */
  onOpenChange?: (open: boolean) => void;
  /** Controlled open state. Pair with `onOpenChange`; omit both for uncontrolled mode. */
  open?: boolean;
  /** **Required.** Plain-text accessible name. String only — no React nodes. */
  title: string;
  /** **Required.** Element that opens the drawer. Wrapped via `Trigger asChild`. */
  trigger: ReactElement;
}

export function Drawer({ children, description, onOpenChange, open, title, trigger }: DrawerProps) {
  return (
    <VaulDrawer.Root onOpenChange={onOpenChange} open={open}>
      <VaulDrawer.Trigger asChild={true}>{trigger}</VaulDrawer.Trigger>
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className={styles.overlay} />
        <VaulDrawer.Content className={styles.content} {...(description ? {} : { 'aria-describedby': undefined })}>
          <div aria-hidden={true} className={styles.handle} />
          <VaulDrawer.Title className={styles.title}>{title}</VaulDrawer.Title>
          {description ? <VaulDrawer.Description className={styles.description}>{description}</VaulDrawer.Description> : null}
          {children}
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}
