import { Content, Portal, Root, Trigger } from '@radix-ui/react-dropdown-menu';

import styles from './Dropdown.module.css';

import type { ReactNode } from 'react';

export type Align = 'center' | 'end' | 'start';

interface DropdownOwnProps {
  /** Menu alignment relative to the trigger. */
  align?: Align;
  children: ReactNode;
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
  const { align, children, label, prefix, suffix } = props;
  const ariaLabel = 'aria-label' in props ? props['aria-label'] : undefined;

  return (
    <Root>
      <Trigger aria-label={ariaLabel} className={styles.trigger}>
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
