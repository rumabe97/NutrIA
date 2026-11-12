import styles from './not-found.module.css';

import { getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';

/**
 * What a `notFound()` anywhere in the signed-in app shows: the whole `/asistente`
 * tree while its switch is off, a dish or a conversation that is not this
 * person's, a professional's page for anybody else. Until project 024 phase 3 it
 * was Next's default page, in English and in no theme.
 *
 * It renders inside the signed-in layout, so the header and the navigation stay
 * round it, and it says no more than the console's own 404 does: the address was
 * wrong. The status is still 404 — this only draws it.
 */
export default async function AppNotFound() {
  const dictionary = await getDictionary();

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>{dictionary.errors.notFound}</h1>
      <div className={styles.actions}>
        <CtaLink href="/inicio">{dictionary.errors.boundaryHome}</CtaLink>
      </div>
    </div>
  );
}
