'use client';
import { useEffect, useState } from 'react';

import Link from 'next/link';

import styles from './SiteHeader.module.css';

import { CtaLink } from 'components/CtaLink';

/**
 * The border only appears once the page has scrolled, so the hero starts on an
 * uninterrupted surface. It is the cheapest way to make a sticky bar stop
 * looking like a toolbar bolted on top of the page.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={styles.header} data-scrolled={scrolled}>
      <div className={styles.inner}>
        <Link aria-label="NutrIA — inicio" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.mark} />
          NutrIA
        </Link>

        <nav aria-label="Secciones" className={styles.nav}>
          <a className={styles.navLink} href="#como-funciona">
            Cómo funciona
          </a>
          <a className={styles.navLink} href="#personalizacion">
            Personalización
          </a>
          <a className={styles.navLink} href="#seguridad">
            Seguridad
          </a>
          <a className={styles.navLink} href="#preguntas">
            Preguntas
          </a>
        </nav>

        <div className={styles.actions}>
          <Link className={styles.signIn} href="/acceder">
            Acceder
          </Link>
          <CtaLink href="/registro" size="sm">
            Crear mi plan
          </CtaLink>
        </div>
      </div>
    </header>
  );
}
