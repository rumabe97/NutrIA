'use client';
import { useEffect, useState } from 'react';

import Link from 'next/link';

import styles from './SiteHeader.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';
import { LocaleSwitcher } from 'components/LocaleSwitcher';

/**
 * The border only appears once the page has scrolled, so the hero starts on an
 * uninterrupted surface. It is the cheapest way to make a sticky bar stop
 * looking like a toolbar bolted on top of the page.
 */
export function SiteHeader() {
  const dictionary = useDictionary();
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
        <Link aria-label={dictionary.siteNav.brandHome} className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.mark} />
          NutrIA
        </Link>

        {/* The anchors are URL fragments, not copy: they stay Spanish so a link
            someone saved still works after a language change. */}
        <nav aria-label={dictionary.siteNav.sectionsLabel} className={styles.nav}>
          <a className={styles.navLink} href="#como-funciona">
            {dictionary.siteNav.howItWorks}
          </a>
          <a className={styles.navLink} href="#personalizacion">
            {dictionary.siteNav.personalisation}
          </a>
          <a className={styles.navLink} href="#seguridad">
            {dictionary.siteNav.safety}
          </a>
          <a className={styles.navLink} href="#preguntas">
            {dictionary.siteNav.questions}
          </a>
        </nav>

        <div className={styles.actions}>
          {/* On the landing page too, and not behind a menu: someone deciding
              whether to sign up at all cannot read a label to open one. */}
          <LocaleSwitcher compact={true} />
          <Link className={styles.signIn} href="/acceder">
            {dictionary.siteNav.signIn}
          </Link>
          <CtaLink className={styles.cta} href="/registro" size="sm">
            {dictionary.siteNav.signUp}
          </CtaLink>
        </div>
      </div>
    </header>
  );
}
