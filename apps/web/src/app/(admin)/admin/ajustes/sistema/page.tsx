import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { DataTable } from 'ui/components/DataTable';
import { parsePeriod } from 'core/domain/Period';
import { StatTile } from 'ui/components/StatTile';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';
import { MEAL_SLOTS } from 'core/entities/Plan';

import { formatDate, formatInstant, formatNumber, formatUsd, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';
import { RECORDING_STARTS } from '../../recordingStart';

import type { AdminSystemView } from 'core/controllers/Admin';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/ajustes/sistema');
}

const PATHNAME = '/admin/ajustes/sistema';

/** The hours after which a scheduled job counts as stale: the API's `CRON_STALE_HOURS`, said in words. */
const STALE_HOURS = 26;

/**
 * Ajustes › Sistema (`0071`): which version is deployed and with which limits, what is set
 * up as yes or no, when each scheduled job last finished (stale in words as well as colour),
 * and the mail handed to the provider, per template over the period and per day in all. Booleans, versions, dates and
 * counts only: never a configuration value, a key, an address or a recipient (`0028`).
 */
export default async function AdminSystemPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, system] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminSystemView>(`/admin/system?period=${period}`)
  ]);

  if (!system) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminSystem;
  const number = (value: number) => formatNumber(value, locale);
  const since = formatDate(RECORDING_STARTS, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const yesNo = (value: boolean) => (value ? t.yes : t.no);
  const at = (iso: string) =>
    formatInstant(Date.parse(iso), locale, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short', timeZone: 'Europe/Madrid' });
  const itemColumns = [
    { header: t.columns.item, key: 'item' },
    { header: t.columns.value, key: 'value' }
  ];

  const versionRows = [
    { item: t.commit, value: system.commit === null ? t.commitNone : <code>{system.commit.slice(0, 7)}</code> },
    { item: t.versions.prompt, value: system.versions.prompt },
    { item: t.versions.steps, value: system.versions.steps },
    { item: t.versions.profileConsent, value: system.versions.profileConsent },
    { item: t.versions.healthConsent, value: system.versions.healthConsent },
    { item: t.versions.careConsent, value: system.versions.careConsent },
    { item: t.versions.professionalAgreement, value: system.versions.professionalAgreement }
  ];

  const capRows = [
    { item: t.caps.oversizedFactor, value: `×${number(system.caps.oversizedFactor)}` },
    { item: t.caps.servingBounds, value: `${number(system.caps.servingBounds.min)}–${number(system.caps.servingBounds.max)}` },
    ...MEAL_SLOTS.map(slot => ({
      item: interpolate(t.caps.servingKcal, { slot: dictionary.slots[slot] }),
      value: `${number(system.caps.servingKcal[slot])} kcal`
    })),
    { item: t.caps.rewriteAttemptBound, value: number(system.caps.rewriteAttemptBound) },
    { item: t.caps.pictureMonthlyUsd, value: formatUsd(system.caps.pictureMonthlyUsd, locale) }
  ];

  const integrationRows = (Object.keys(t.integrations) as (keyof typeof t.integrations)[]).map(key => ({
    item: t.integrations[key],
    value: yesNo(system.integrations[key])
  }));

  const cronRows = system.crons.map(cron => ({
    id: cron.job,
    cells: {
      job: t.crons[cron.job],
      lastRun: cron.lastRunAt === null ? t.cronNever : at(cron.lastRunAt),
      state: (
        <span className={styles.state} data-stale={cron.stale ? 'true' : undefined}>
          {cron.stale ? t.cronState.stale : t.cronState.ok}
        </span>
      )
    }
  }));

  const mailRows = system.mail.kinds.map(kind => ({
    id: kind.kind,
    cells: { failed: number(kind.failed), kind: t.mailKinds[kind.kind as keyof typeof t.mailKinds] ?? kind.kind, sent: number(kind.sent) }
  }));

  const asRows = (rows: readonly { item: string; value: React.ReactNode }[]) =>
    rows.map(row => ({ id: row.item, cells: { item: row.item, value: row.value } }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      <AdminSection title={t.versionsTitle}>
        <Card className={styles.table}>
          <DataTable caption={t.versionsTitle} columns={itemColumns} empty="—" hideCaption={true} rows={asRows(versionRows)} />
        </Card>
      </AdminSection>

      <AdminSection title={t.integrationsTitle}>
        <Card className={styles.table}>
          <DataTable caption={t.integrationsTitle} columns={itemColumns} empty="—" hideCaption={true} rows={asRows(integrationRows)} />
        </Card>
      </AdminSection>

      <AdminSection note={interpolate(t.cronNote, { hours: STALE_HOURS })} title={t.cronTitle}>
        <Card className={styles.table}>
          <DataTable
            caption={t.cronCaption}
            columns={[
              { header: t.columns.job, key: 'job' },
              { header: t.columns.lastRun, key: 'lastRun' },
              { header: t.columns.state, key: 'state' }
            ]}
            empty={t.cronEmpty}
            hideCaption={true}
            rows={cronRows}
          />
        </Card>
      </AdminSection>

      <AdminSection title={t.mailTitle}>
        <div className={styles.stack}>
          <ul className={styles.tiles}>
            <Card as="li" padding="sm">
              <StatTile label={t.mailSeries.sent} locale={locale} value={number(system.mail.totals.sent)} />
            </Card>
            <Card as="li" padding="sm">
              <StatTile label={t.mailSeries.failed} locale={locale} value={number(system.mail.totals.failed)} />
            </Card>
          </ul>
          <Card>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.mailEmpty}
              labels={system.mail.days}
              labelsHeader={common.day}
              locale={locale}
              series={[
                { name: t.mailSeries.sent, tone: 'success', values: system.mail.perDay.sent },
                { name: t.mailSeries.failed, tone: 'failure', values: system.mail.perDay.failed }
              ]}
              stacked={true}
              title={t.mailChart}
            />
          </Card>
          <Card className={styles.table}>
            <DataTable
              caption={t.mailCaption}
              columns={[
                { header: t.columns.template, key: 'kind' },
                { align: 'end', header: t.mailSeries.sent, key: 'sent' },
                { align: 'end', header: t.mailSeries.failed, key: 'failed' }
              ]}
              empty={t.mailEmpty}
              hideCaption={true}
              rows={mailRows}
            />
          </Card>
        </div>
      </AdminSection>

      <AdminSection title={t.capsTitle}>
        <Card className={styles.table}>
          <DataTable caption={t.capsTitle} columns={itemColumns} empty="—" hideCaption={true} rows={asRows(capRows)} />
        </Card>
      </AdminSection>

      <HowCounted notes={t.howCounted.map(note => interpolate(note, { date: since }))} summary={common.howCounted} />
    </div>
  );
}
