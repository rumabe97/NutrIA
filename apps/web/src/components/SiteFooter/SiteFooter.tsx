'use client';
import Link from 'next/link';

import styles from './SiteFooter.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

export function SiteFooter() {
  const dictionary = useDictionary();
  const { footer, siteNav } = dictionary;

  const locale = useLocale();

  // Each page links to its own language's pages: a crawler carries no cookie to be redirected
  // by, and the English pages would otherwise hand their links to the Spanish ones.
  const columns = [
    {
      links: [
        { href: '#como-funciona', label: siteNav.howItWorks },
        { href: '#personalizacion', label: siteNav.personalisation },
        { href: '#preguntas', label: siteNav.questions }
      ],
      title: footer.product
    },
    {
      links: [
        { href: withLocale('/registro', locale), label: footer.createAccount },
        { href: withLocale('/acceder', locale), label: footer.signIn }
      ],
      title: footer.account
    },
    {
      // The pages came first, then the links: this column once pointed at two
      // addresses that did not exist, and every visitor's browser prefetched
      // both and logged two 404s a page.
      links: [
        { href: withLocale('/privacidad', locale), label: footer.privacyPolicy },
        { href: withLocale('/condiciones', locale), label: footer.terms }
      ],
      title: footer.legal
    }
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div>
            <Text className={styles.brand} size="lg" weight="semibold">
              NutrIA
            </Text>
            <Text size="sm" tone="secondary">
              {footer.tagline}
            </Text>
          </div>

          <div className={styles.columns}>
            {columns.map(column => (
              <div key={column.title}>
                <Text as="span" className={styles.columnTitle} size="sm" weight="medium">
                  {column.title}
                </Text>
                <ul className={styles.list}>
                  {column.links.map(link => (
                    <li key={link.href}>
                      <Link className={styles.link} href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          {/* Stated plainly and permanently, not buried in a modal: this is a
              planning tool, and it does not replace clinical advice. */}
          <Text className={styles.disclaimer} size="xs" tone="tertiary">
            {footer.disclaimer}
          </Text>
          <Text size="xs" tone="tertiary">
            © {new Date().getFullYear()} NutrIA
          </Text>
        </div>
      </div>
    </footer>
  );
}
