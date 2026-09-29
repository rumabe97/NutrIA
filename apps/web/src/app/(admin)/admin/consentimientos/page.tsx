import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { DataTable } from 'ui/components/DataTable';
import { StatTile } from 'ui/components/StatTile';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';

import { formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AdminConsentsView } from 'core/controllers/Admin';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/consentimientos');
}

/**
 * Personas › Consentimientos (`0071`): for each versioned consent, the version in force and
 * how many accounts hold it or an older one, the profile consent against the accounts that
 * finished onboarding, and the care links that share health. Numbers only (`0028`): no
 * account, no date and no value of anybody's.
 *
 * The privacy policy is informed, never accepted, so it is not a row here.
 */
export default async function AdminConsentsPage() {
  const [dictionary, locale, consents] = await Promise.all([getDictionary(), activeLocale(), serverApi<AdminConsentsView>('/admin/consents')]);

  if (!consents) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminConsents;
  const number = (value: number) => formatNumber(value, locale);

  const rows = consents.consents.map(consent => ({
    id: consent.key,
    cells: {
      consent: t.consents[consent.key],
      current: number(consent.current),
      older: number(consent.older),
      version: consent.currentVersion,
      versions:
        consent.versions.length === 0
          ? '—'
          : consent.versions.map(entry => interpolate(t.versionOf, { n: number(entry.n), version: entry.version ?? t.unaccepted })).join(' · ')
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />

      <ul aria-label={t.tilesLabel} className={styles.tiles}>
        <Card as="li" padding="sm">
          <StatTile
            label={t.onboarded}
            locale={locale}
            note={interpolate(t.onboardedNote, { holding: number(consents.onboarded.holding), total: number(consents.onboarded.total) })}
            value={number(consents.onboarded.holding)}
          />
        </Card>
      </ul>

      <AdminSection title={t.caption}>
        <Card className={styles.table}>
          <DataTable
            caption={t.caption}
            columns={[
              { header: t.columns.consent, key: 'consent' },
              { header: t.columns.version, key: 'version' },
              { align: 'end', header: t.columns.current, key: 'current' },
              { align: 'end', header: t.columns.older, key: 'older' },
              { header: t.columns.versions, key: 'versions' }
            ]}
            empty={t.empty}
            hideCaption={true}
            rows={rows}
          />
        </Card>
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
