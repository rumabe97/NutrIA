import NXLink from 'next/link';

import styles from './Link.module.css';

import type { AriaAttributes, ReactNode } from 'react';

export interface LinkProps {
  /** Set `'page'` on the active link in a nav list — SRs announce "current page". CSS `.active` doesn't reach assistive tech. */
  'aria-current'?: AriaAttributes['aria-current'];
  children?: ReactNode;
  className?: string;
  /** **Required.** Destination URL — internal route or external URL. */
  href: string;
  /** Visible underline + brand colour. Use in prose (WCAG 1.4.1); skip in nav where context already identifies the link. */
  inline?: boolean;
  /** Forwarded to `next/link`. `null` (default) prefetches static routes; `false` disables; `true` forces. */
  prefetch?: boolean | null;
  /** `rel`. Defaults to `'noopener noreferrer'` when `target="_blank"` and not explicitly set. */
  rel?: string;
  /** Browsing context. Use `'_blank'` for new-tab links — `rel` auto-defaults to `noopener noreferrer`. */
  target?: '_blank' | '_parent' | '_self' | '_top';
}

export function Link({ 'aria-current': ariaCurrent, children, className, href, inline, prefetch, rel, target }: LinkProps) {
  // When opening in a new tab, default to `noopener noreferrer`. Modern browsers add
  // `noopener` implicitly for `target="_blank"` but `noreferrer` is NOT — the destination
  // would still see the Referer header. Defense in depth: apply both unless the consumer
  // passed their own `rel`.
  const safeRel = target === '_blank' && rel === undefined ? 'noopener noreferrer' : rel;
  const classes = [styles.link, inline ? styles.inline : undefined, className].filter(Boolean).join(' ');

  return (
    <NXLink aria-current={ariaCurrent} className={classes} href={href} prefetch={prefetch} rel={safeRel} target={target}>
      {children}
    </NXLink>
  );
}
