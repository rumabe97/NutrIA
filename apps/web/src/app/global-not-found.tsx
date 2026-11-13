import styles from './global-not-found.module.css';

import { dictionaryFor } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';

import { MAIN_ID } from './_shared/mainId';
import { RootShell } from './_shared/RootShell';
import { siteViewport } from './_shared/metadata';

import type { Metadata, Viewport } from 'next';

const spanish = dictionaryFor('es-ES');
const english = dictionaryFor('en-GB');

export const metadata: Metadata = { title: spanish.errors.notFoundTitle };

export const viewport: Viewport = siteViewport;

/**
 * An address that matches no page at all — `/no-existe`, `/en/no-existe`, `/plan/no-existe`.
 *
 * The app has four root layouts (`_shared/RootShell`), so there is no one layout a 404 for
 * every tree could be drawn inside, and until this file Next answered with its own page:
 * no `lang`, in English, in no theme and with no way back. This is Next's
 * `global-not-found` (`experimental.globalNotFound` in `next.config.js`): one static page,
 * drawn in the root shell — the language, the theme script, the faces, the skip link.
 *
 * It is told nothing about the address, so it cannot know which language was being read: it
 * speaks Spanish, the site's first language, and says the same in English under it, marked
 * `lang`, each with the way to its own home page. The status is 404 and Next adds `noindex`.
 * A `notFound()` inside a tree still draws that tree's own page (`(app)/not-found.tsx`,
 * `(admin)/not-found.tsx`).
 */
export default function GlobalNotFound() {
  return (
    <RootShell locale="es-ES">
      <main className={styles.shell} id={MAIN_ID}>
        <h1 className={styles.title}>{spanish.errors.notFoundTitle}</h1>
        <p className={styles.body}>{spanish.errors.notFound}</p>
        <div className={styles.actions}>
          <CtaLink href="/">{spanish.errors.notFoundHome}</CtaLink>
        </div>

        <div className={styles.other} lang="en">
          <p className={styles.otherTitle}>{english.errors.notFoundTitle}</p>
          <p className={styles.body}>{english.errors.notFound}</p>
          <div className={styles.actions}>
            <CtaLink href="/en" variant="secondary">
              {english.errors.notFoundHome}
            </CtaLink>
          </div>
        </div>
      </main>
    </RootShell>
  );
}
