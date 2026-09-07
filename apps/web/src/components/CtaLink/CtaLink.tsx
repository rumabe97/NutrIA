import Link from 'next/link';

import styles from './CtaLink.module.css';

import type { ComponentPropsWithoutRef } from 'react';

interface CtaLinkProps extends ComponentPropsWithoutRef<typeof Link> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'primary' | 'secondary';
}

export function CtaLink({ className, size = 'md', variant = 'primary', ...rest }: CtaLinkProps) {
  return <Link className={[styles.cta, styles[size], styles[variant], className].filter(Boolean).join(' ')} {...rest} />;
}
