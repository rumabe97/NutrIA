import type { ComponentPropsWithRef } from 'react';

export interface SpacerProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  /** Vertical space in `rem`. Defaults to `1`. Prefer parent `gap` on VStack/Flex/Grid — reach for Spacer only when there's no shared parent. */
  space?: number;
}

export function Spacer({ space = 1, style, ...rest }: SpacerProps) {
  return <span aria-hidden={true} style={{ marginTop: `${space}rem`, ...style }} {...rest} />;
}
