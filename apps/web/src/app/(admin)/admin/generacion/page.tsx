import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { BarChart } from 'ui/components/BarChart';
import { ColumnChart } from 'ui/components/ColumnChart';
import { LineChart } from 'ui/components/LineChart';
import { parsePeriod } from 'core/domain/Period';

import { AdminCountList } from 'components/AdminCountList';
import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { Card } from 'components/Card';
import { GenerationCalls } from 'components/GenerationCalls';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD, PERIODS } from 'core/entities/Period';
import { GENERATION_STATUSES, generationQuerySchema } from 'core/entities/AdminQuery';

import { formatInstant, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AdminCountRow } from 'components/AdminCountList';
import type { AdminGenerationStatsView, AdminGenerationsView } from 'core/controllers/Admin';
import type { AdminTableColumn, AdminTableFilter } from 'components/AdminTable';
import type { DishRejection } from 'core/entities/Plan';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/generacion');
}

const PATHNAME = '/admin/generacion';

/**
 * Registro (`0050`, `0068`): how the period's generations ended, how long the finished
 * ones took, why the failed ones failed and why dishes were dropped — then every
 * generation, searchable by address, with its model calls folded in its row.
 *
 * The charts are counts over everybody and name nobody. The table names the account
 * that asked, and shows each row exactly as the API gives it: the addressed row comes
 * without the rejection reasons that describe the person (`allergen`, `unwanted`) and
 * without an invalid plan's figures (`0028`). Rejections by reason, those included, are
 * only ever the period's totals, in their chart — never a row's.
 */
export default async function AdminLogPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const table = readTableQuery(generationQuerySchema, query);
  const [dictionary, locale, generations, stats] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminGenerationsView>(`/admin/generations?${apiSearch(table)}`),
    serverApi<AdminGenerationStatsView>(`/admin/generations/stats?period=${period}`)
  ]);

  if (!generations) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const outcomes = dictionary.adminSummary.outcomes;
  const t = dictionary.adminLog;
  const number = (value: number) => formatNumber(value, locale);
  const seconds = (value: number) =>
    interpolate(common.seconds, { seconds: formatNumber(value, locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) });
  const started = (iso: string) =>
    formatInstant(Date.parse(iso), locale, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short', timeZone: 'Europe/Madrid' });

  // A code the dictionary knows is said in words; one it does not is shown as it is.
  const codeLabel = (code: string) => (t.codes as Readonly<Record<string, string>>)[code] ?? code;

  // The codes worth offering are the ones that happened; one the address names stays
  // offered, so the field always says what the table is filtered by.
  const codes = [...new Set([...(stats?.failuresByCode ?? []).flatMap(row => (row.code ? [row.code] : [])), ...(table.code ? [table.code] : [])])];

  const columns: AdminTableColumn[] = [
    // The start time first: DataTable makes the first column the row's name, and "26 sept,
    // 15:03" tells rows apart where "Fallida" / "Terminada" named 25 rows two ways.
    { header: t.columns.started, key: 'started' },
    { header: t.columns.status, key: 'status' },
    { header: t.columns.account, key: 'account' },
    { align: 'end', header: t.columns.seconds, key: 'seconds' },
    { align: 'end', header: t.columns.attempts, key: 'attempts' },
    { header: t.columns.plan, key: 'plan' },
    { header: t.columns.code, key: 'code' },
    { header: t.columns.detail, key: 'detail' },
    { header: t.columns.calls, key: 'calls' }
  ];

  const filters: AdminTableFilter[] = [
    {
      anyLabel: common.table.any,
      label: t.columns.status,
      name: 'status',
      options: GENERATION_STATUSES.map(status => ({ label: t.statuses[status], value: status })),
      value: table.status
    },
    {
      anyLabel: common.table.any,
      label: t.code,
      name: 'code',
      options: codes.map(code => ({ label: codeLabel(code) === code ? code : `${codeLabel(code)} (${code})`, value: code })),
      value: table.code
    },
    {
      anyLabel: common.table.any,
      label: t.since,
      name: 'since',
      options: [
        { label: t.sinceDay, value: '24h' },
        ...PERIODS.map(days => ({ label: interpolate(t.sinceDays, { days: number(days) }), value: String(days) }))
      ],
      value: table.since
    },
    { kind: 'date', label: t.from, name: 'from', value: table.from },
    { kind: 'date', label: t.to, name: 'to', value: table.to }
  ];

  const rows = generations.rows.map(generation => ({
    id: generation.id,
    cells: {
      account: generation.account.email,
      attempts: number(generation.attempts),
      calls: <GenerationCalls calls={generation.calls} locale={locale} slots={dictionary.slots} words={t} />,
      code: generation.code ? (
        <div className={styles.code}>
          <span>{codeLabel(generation.code)}</span>
          {codeLabel(generation.code) === generation.code ? null : <span className={styles.raw}>{generation.code}</span>}
        </div>
      ) : (
        '—'
      ),
      detail: generation.detail ? <p className={styles.prose}>{generation.detail}</p> : '—',
      plan: generation.plan
        ? interpolate(t.logPlan, {
            model: generation.plan.model ?? '—',
            prompt: generation.plan.promptVersion ?? '—',
            reused: number(generation.plan.reused ?? 0),
            version: number(generation.plan.version)
          })
        : '—',
      seconds: generation.seconds === null ? '—' : formatNumber(generation.seconds, locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
      started: generation.startedAt ? started(generation.startedAt) : '—',
      status: <span data-status={generation.status}>{t.statuses[generation.status as keyof typeof t.statuses] ?? generation.status}</span>
    }
  }));

  // One row a code, the commonest first as the API sends them; each opens the table filtered to it
  // within the same period. A failure that left no code has no filter to open.
  const failureRows: readonly AdminCountRow[] = (stats?.failuresByCode ?? []).map(row => ({
    id: row.code ?? 'none',
    count: number(row.n),
    href: row.code ? `${PATHNAME}?${new URLSearchParams({ code: row.code, since: String(period) })}` : undefined,
    label: row.code ? codeLabel(row.code) : t.noCode
  }));

  const outcome = (key: string) => stats?.outcomes.series.find(series => series.key === key)?.values ?? [];
  const pending = (stats?.outcomes.days ?? []).map((_, index) => (outcome('queued')[index] ?? 0) + (outcome('running')[index] ?? 0));
  // A day with no finished generation has no duration: it is left out, never drawn as an
  // instant 0. The line joins the days either side, spaced by their real distance.
  const timed = stats ? stats.durations.days.flatMap((day, index) => (stats.durations.p50[index] === null ? [] : [index])) : [];

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      {stats ? (
        <AdminSection title={t.chartsTitle}>
          <div className={styles.charts}>
            <Card>
              <ColumnChart
                className={styles.chart}
                dataLabel={common.dataLabel}
                emptyLabel={t.outcomesEmpty}
                labels={stats.outcomes.days}
                labelsHeader={common.day}
                locale={locale}
                series={[
                  { name: outcomes.succeeded, tone: 'success', values: outcome('succeeded') },
                  { name: outcomes.failed, tone: 'failure', values: outcome('failed') },
                  { name: outcomes.pending, tone: 'neutral', values: pending }
                ]}
                stacked={true}
                title={t.outcomesChart}
                totalLabel={dictionary.adminSummary.total}
              />
            </Card>
            <Card>
              <LineChart
                className={styles.chart}
                dataLabel={common.dataLabel}
                emptyLabel={t.durationsEmpty}
                formatValue={seconds}
                labels={timed.map(index => stats.durations.days[index] ?? '')}
                labelsHeader={common.day}
                locale={locale}
                series={[
                  { name: t.p50, tone: 1, values: timed.map(index => stats.durations.p50[index] ?? 0) },
                  { name: t.p95, tone: 2, values: timed.map(index => stats.durations.p95[index] ?? 0) }
                ]}
                title={t.durationsChart}
              />
            </Card>
            <Card>
              <BarChart
                className={styles.chart}
                dataLabel={common.dataLabel}
                emptyLabel={t.rejectionsEmpty}
                labels={stats.rejectionsByReason.map(row => t.rejection[row.reason as DishRejection] ?? row.reason)}
                labelsHeader={t.reason}
                locale={locale}
                series={[{ name: t.rejectionsSeries, values: stats.rejectionsByReason.map(row => row.n) }]}
                title={t.rejectionsChart}
              />
            </Card>
          </div>
        </AdminSection>
      ) : null}

      {stats ? (
        <AdminSection note={t.failuresNote} title={t.failuresTitle}>
          {failureRows.length === 0 ? (
            <Card>
              <p className={styles.empty}>{t.failuresEmpty}</p>
            </Card>
          ) : (
            <AdminCountList label={t.failuresTitle} rows={failureRows} />
          )}
        </AdminSection>
      ) : null}

      <AdminSection note={t.tableNote} title={t.tableTitle}>
        <AdminTable
          caption={t.caption}
          columns={columns}
          empty={t.empty}
          filters={filters}
          locale={locale}
          noMatch={t.noMatch}
          paging={{ offset: generations.offset, size: generations.size }}
          pathname={PATHNAME}
          query={query}
          rows={rows}
          search={{ label: t.search, value: table.q }}
          total={generations.total}
          words={common.table}
        />
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
