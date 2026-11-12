'use client';
import { Fragment, useEffect, useState } from 'react';

import Link from 'next/link';

import styles from './SiteHeader.module.css';

import { useDictionary } from 'i18n/LocaleProvider';

import { CtaLink } from 'components/CtaLink';
import { HeaderPattern } from 'components/HeaderPattern';
import { LocaleSwitcher } from 'components/LocaleSwitcher';
import { ThemeSwitcher } from 'components/ThemeSwitcher';

/**
 * The public pages' header (project 024 phase 7), drawn as the signed-in shell's is: the
 * brand in the display face, the hatched pattern behind it, and glass under it once the page
 * has scrolled, so nothing passing under the header is read through its words.
 *
 * **The glass is the default and the top of the page is the exception**, told by script
 * (`data-at-top`), for the reason `AppNav` gives: a header that fails must fail readable.
 */
export function SiteHeader() {
  const dictionary = useDictionary();
  const [atTop, setAtTop] = useState<boolean | null>(null);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY <= 4);

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Fragment>
      <HeaderPattern />

      <header className={styles.header} data-at-top={atTop === null ? undefined : atTop}>
        <div className={styles.inner}>
          <Link aria-label={dictionary.siteNav.brandHome} className={styles.brand} href="/">
            <span aria-hidden="true" className={styles.mark} />
            <span className={styles.wordmark}>NutrIA</span>
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
            <ThemeSwitcher />
            <Link className={styles.signIn} href="/acceder">
              {dictionary.siteNav.signIn}
            </Link>
            <CtaLink className={styles.cta} href="/registro" size="sm">
              {dictionary.siteNav.signUp}
            </CtaLink>
          </div>
        </div>
      </header>
    </Fragment>
  );
}
