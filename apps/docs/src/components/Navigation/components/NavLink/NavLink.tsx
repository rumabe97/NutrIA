'use client';
import { usePathname } from 'next/navigation';

import styles from './NavLink.module.css';

import { Link } from 'ui/components/Link';

interface NavLinkProps {
  href: string;
  name: string;
}

export function NavLink({ href, name }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <li>
      <Link aria-current={isActive ? 'page' : undefined} className={isActive ? `${styles.link} ${styles.active}` : styles.link} href={href}>
        {name}
      </Link>
    </li>
  );
}
