import styles from './page.module.css';

import { Heading } from 'ui/components/Heading';
import { Link } from 'ui/components/Link';
import { Text } from 'ui/components/Text';

const STACK = ['Next.js 16', 'Turborepo', 'pnpm workspaces', 'TypeScript', 'React 19', 'Vitest 4', 'Radix UI', 'ESLint 9', 'Prettier', 'Shiki'];

const SECTIONS = [
  {
    blurb:
      'A design system of accessible, token-driven components. Layout primitives, typography, and Radix-based interactive components — each with a live preview, props table, and accessibility notes.',
    href: '/ui',
    index: '01',
    stat: '30+ components',
    title: 'UI'
  },
  {
    blurb:
      'How the template tests itself, and the conventions we expect any app built on top to follow. Vitest setup, jsdom polyfills, coverage thresholds, and honest guidance on where unit tests stop and end-to-end begins.',
    href: '/tests',
    index: '02',
    stat: '268 unit tests',
    title: 'Tests'
  }
] as const;

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <Text className={styles.eyebrow} size="xs" tone="tertiary">
          mini template · v0.1
        </Text>
        <Heading className={styles.title} level="1">
          A batteries-included Next.js&nbsp;monorepo, designed to&nbsp;ship.
        </Heading>
        <Text className={styles.lede} size="md" tone="secondary">
          Opinionated foundations for production Next.js apps. Tested, accessible, type-safe — fork it and start shipping instead of wiring tooling.
        </Text>
      </section>

      <section aria-labelledby="stack-heading" className={styles.stack}>
        <Text className={styles.sectionLabel} id="stack-heading" size="xs" tone="tertiary">
          Stack
        </Text>
        <ul className={styles.stackList}>
          {STACK.map(item => (
            <li className={styles.stackItem} key={item}>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="browse-heading" className={styles.browse}>
        <Text className={styles.sectionLabel} id="browse-heading" size="xs" tone="tertiary">
          Browse
        </Text>
        <ul className={styles.list}>
          {SECTIONS.map(({ blurb, href, index, stat, title }) => (
            <li className={styles.item} key={href}>
              <Link className={styles.link} href={href}>
                <span aria-hidden="true" className={styles.itemIndex}>
                  {index}
                </span>
                <span className={styles.itemBody}>
                  <span className={styles.itemTitleRow}>
                    <Heading className={styles.itemTitle} level="2" size="md">
                      {title}
                    </Heading>
                    <Text className={styles.itemStat} size="xs" tone="tertiary">
                      {stat}
                    </Text>
                  </span>
                  <Text size="sm" tone="secondary">
                    {blurb}
                  </Text>
                  <span className={styles.itemCta}>
                    Explore <span aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <Text size="xs" tone="tertiary">
          Built with the components on this site. Source on the repo.
        </Text>
      </footer>
    </main>
  );
}
