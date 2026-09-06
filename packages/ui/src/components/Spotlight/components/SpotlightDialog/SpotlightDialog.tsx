'use client';
import { Content, Overlay, Portal, Root } from '@radix-ui/react-dialog';

import { Spotlight } from '../../Spotlight';

import type { DialogProps } from '../../types';

/** Renders the command menu inside a Radix Dialog. */
export function SpotlightDialog(props: DialogProps) {
  const { container, contentClassName, onOpenChange, open, overlayClassName, ref, ...etc } = props;

  return (
    <Root onOpenChange={onOpenChange} open={open}>
      <Portal container={container}>
        <Overlay className={overlayClassName} data-spotlight-overlay="" />
        <Content aria-label={props.label} className={contentClassName} data-spotlight-dialog="">
          <Spotlight ref={ref} {...etc} />
        </Content>
      </Portal>
    </Root>
  );
}
