import { Content, Portal, Root, Trigger } from '@radix-ui/react-dropdown-menu';

import styles from './Dropdown.module.css';

import type { ReactNode } from 'react';

export type Align = 'center' | 'end' | 'start';

interface DropdownOwnProps {
  /** Menu alignment relative to the trigger. */
  align?: Align;
  children: ReactNode;
  /** Composed onto the trigger's own class. */
  className?: string;
  /** Leading visual before the trigger label (usually an icon). */
  prefix?: ReactNode;
  /** Trailing visual after the trigger label (usually a chevron). */
  suffix?: ReactNode;
}

/**
 * Pass a `string` label (used as both visible text and accessible name) OR a `ReactNode`
 * label plus `aria-label`. The discriminated union forces icon-only triggers to ship a name.
 */
export type DropdownProps = DropdownOwnProps & ({ 'aria-label': string; label: ReactNode } | { 'aria-label'?: string; label: string });

export function Dropdown(props: DropdownProps) {
  const { align, children, className, label, prefix, suffix } = props;
  const ariaLabel = 'aria-label' in props ? props['aria-label'] : undefined;

  return (
    // Not modal, on purpose. A modal menu locks the page's scroll by setting `overflow: hidden`
    // on <body>, which turns <body> into the scroll container a sticky header sticks to: opened
    // from a header on a scrolled page, the header — and the menu anchored to it — jumped to the
    // top of the document, out of sight (found on the theme menu, project 024). A menu needs no
    // lock: it closes on a press outside and on Escape, and follows its trigger while open.
    <Root modal={false}>
      <Trigger aria-label={ariaLabel} className={className ? `${styles.trigger} ${className}` : styles.trigger}>
        {prefix ? prefix : null}
        <span className={styles.label}>{label}</span>
        {suffix ? suffix : null}
      </Trigger>
      <Portal>
        <Content align={align} className={styles.content}>
          {children}
        </Content>
      </Portal>
    </Root>
  );
}
