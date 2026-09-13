import Link from 'next/link';

import { buttonClassName } from 'ui/components/Button';

import type { ComponentPropsWithoutRef } from 'react';

interface CtaLinkProps extends ComponentPropsWithoutRef<typeof Link> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'tertiary';
}

/**
 * A link that reads as a button.
 *
 * `ui/components/Button` renders a real `<button>`, and wrapping an anchor in
 * one is invalid HTML that breaks middle-click, "open in new tab" and the
 * browser's own link affordances. So navigation keeps its `<a>` and borrows
 * the button's classes: one vocabulary, whatever the element.
 */
export function CtaLink({ className, size = 'md', variant = 'primary', ...rest }: CtaLinkProps) {
  return <Link className={buttonClassName({ className, size, variant })} {...rest} />;
}
