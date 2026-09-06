'use client';
import styles from './Sidebar.module.css';

import { Drawer } from 'vaul';

import type { CSSProperties, ReactElement, ReactNode } from 'react';

// vaul reads `--initial-transform` from inline style to drive its slide-in animation
// (see `[data-vaul-drawer][data-vaul-snap-points=true]` rules in `vaul/dist/index.mjs`).
// `CSSProperties` doesn't model `--*` custom properties, so we extend it via an indexed
// signature — no `as` cast required.
interface CSSPropertiesWithVars extends CSSProperties {
  [key: `--${string}`]: number | string;
}

const sidebarStyle: CSSPropertiesWithVars = { '--initial-transform': 'calc(100% + 8px)' };

export interface SidebarProps {
  /** Sidebar body. */
  children: ReactNode;
  /** Optional descriptive paragraph announced after the title. When omitted, `aria-describedby` is nulled. */
  description?: string;
  /** Edge the sidebar slides in from. Defaults to `'left'`. */
  direction?: 'left' | 'right';
  /** Controlled open handler. Omit for uncontrolled. */
  onOpenChange?: (open: boolean) => void;
  /** Controlled open state. Pair with `onOpenChange`; omit both for uncontrolled mode. */
  open?: boolean;
  /** **Required.** Plain-text accessible name. String only. */
  title: string;
  /** **Required.** Element that opens the sidebar. Wrapped via `Trigger asChild`. */
  trigger: ReactElement;
}

export function Sidebar({ children, description, direction = 'left', onOpenChange, open, title, trigger }: SidebarProps) {
  return (
    <Drawer.Root direction={direction} handleOnly={true} onOpenChange={onOpenChange} open={open}>
      <Drawer.Trigger asChild={true}>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
        <Drawer.Content asChild={true}>
          <aside
            className={`${styles.sidebar} ${styles[direction]}`}
            style={sidebarStyle}
            {...(description ? {} : { 'aria-describedby': undefined })}
          >
            <Drawer.Title className={styles.title}>{title}</Drawer.Title>
            {description ? <Drawer.Description className={styles.description}>{description}</Drawer.Description> : null}
            {children}
          </aside>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
