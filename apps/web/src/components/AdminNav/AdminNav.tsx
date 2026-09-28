'use client';
import { useState } from 'react';

import { usePathname } from 'next/navigation';

import styles from './AdminNav.module.css';

import { Button } from 'ui/components/Button';
import { Sidebar } from 'ui/components/Sidebar';
import { useDictionary } from 'i18n/LocaleProvider';

import { AdminNavList } from './components/AdminNavList';

/**
 * The console's navigation (`0068`), and nothing of the app's: no `AppNav`, no
 * offline state, because these pages hold email addresses and are never kept
 * on a device.
 *
 * Wide screens get a sidebar that stays; below 60rem a bar with the console's
 * name and a menu button that opens the same list in a drawer. A client
 * component only because the current page is read from the address.
 */
export function AdminNav() {
  const dictionary = useDictionary();
  const t = dictionary.adminNav;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <p className={styles.title}>{t.title}</p>
        <Sidebar
          onOpenChange={setOpen}
          open={open}
          title={t.title}
          trigger={
            <Button className={styles.menu} size="sm" type="button" variant="secondary">
              <svg aria-hidden="true" className={styles.menuIcon} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
              {t.menu}
            </Button>
          }
        >
          <AdminNavList onNavigate={() => setOpen(false)} pathname={pathname} />
          <Button className={styles.close} onClick={() => setOpen(false)} size="sm" type="button" variant="tertiary">
            {dictionary.common.close}
          </Button>
        </Sidebar>
      </header>

      <div className={styles.sidebar}>
        <p className={styles.title}>{t.title}</p>
        <AdminNavList pathname={pathname} />
      </div>
    </div>
  );
}
