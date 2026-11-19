import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from '../subpage.module.css';

import { getDictionary } from 'i18n/server';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { FirstLookQueue } from 'components/FirstLookQueue';

import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { Metadata } from 'next';
import type { ProfileQueueView } from 'core/controllers/Professional';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/profesionales/perfiles');
}

/**
 * Profesionales › perfiles por mirar (project 025 phase 9, PRD criterion 18; sheet
 * «ConsolaPerfiles»): each profile created or edited since the owner last looked,
 * oldest first, in the practitioner's own words, with what the word filter says. The
 * look gates nothing; the owner marks a profile seen or hides it, and hiding is the one
 * act that refuses. The queue never names a client (`0028`), and nothing here reads a
 * profile's studies as checked.
 */
export default async function AdminProfileQueuePage() {
  const [dictionary, queue] = await Promise.all([getDictionary(), serverApi<ProfileQueueView>('/admin/professionals/queue')]);

  if (!queue) {
    notFound();
  }

  const t = dictionary.adminProfiles;

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link className={styles.link} href="/admin/profesionales">
          {t.back}
        </Link>
      </p>

      <AdminPageHeader intro={t.intro} title={t.title} />

      <FirstLookQueue profiles={queue.profiles} />
    </div>
  );
}
