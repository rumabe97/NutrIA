'use client';
import Link from 'next/link';

import styles from './SiteFooter.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

export function SiteFooter() {
  const dictionary = useDictionary();
  const { footer, siteNav } = dictionary;

  // The hrefs are fixed; only the words move.
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
        { href: '/registro', label: footer.createAccount },
        { href: '/acceder', label: footer.signIn }
      ],
      title: footer.account
    },
    {
      // Just the one page for now (`0058`): a privacy policy is what Google's
      // and Apple's sign-in both require somebody to read before this button
      // existed. Terms of service is a different promise — pricing, cancelling
      // a subscription — and comes when there is something to say about them.
      links: [{ href: '/privacidad', label: footer.privacyPolicy }],
      title: footer.legal
    }
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div>
            <Text size="lg" weight="semibold">
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
