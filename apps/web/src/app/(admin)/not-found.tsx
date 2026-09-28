import styles from './not-found.module.css';

import { getDictionary } from 'i18n/server';

import { CtaLink } from 'components/CtaLink';

import { MAIN_ID } from '../_shared/mainId';

/**
 * What anybody but an admin gets at any address of the console (`0028`,
 * `0068`), and what a console page that cannot load its figures falls back to.
 *
 * It sits at the root of `(admin)`, not beside the gate: a boundary wraps the
 * pages of its own segment but not that segment's layout, so this is the
 * nearest one above `admin/layout.tsx`'s `notFound()`. Here it renders inside
 * the root shell — the language, the skip link — with none of the console's
 * frame, so nothing on it says the address was anything but wrong.
 *
 * An unknown address such as `/admin/zzz` lands here too (`admin/[...rest]`), and
 * every console page's title is the 404's for anybody but an admin
 * (`admin/consoleMetadata.ts`), so a real address and a made-up one read the same.
 * The addresses are public anyway (the repository, `robots.txt`); what this
 * protects is the data behind them, which the API's `@Roles('admin')` refuses to
 * anybody else.
 */
export default async function AdminNotFound() {
  const dictionary = await getDictionary();

  return (
    <main className={styles.shell} id={MAIN_ID}>
      <h1 className={styles.title}>{dictionary.errors.notFound}</h1>
      <div className={styles.actions}>
        <CtaLink href="/inicio">{dictionary.errors.boundaryHome}</CtaLink>
      </div>
    </main>
  );
}
