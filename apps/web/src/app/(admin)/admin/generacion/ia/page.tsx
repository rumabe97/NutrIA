import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { BarChart } from 'ui/components/BarChart';
import { ColumnChart } from 'ui/components/ColumnChart';
import { DataTable } from 'ui/components/DataTable';
import { Gauge } from 'ui/components/Gauge';
import { LineChart } from 'ui/components/LineChart';
import { parsePeriod } from 'core/domain/Period';
import { StatTile } from 'ui/components/StatTile';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';

import { formatDate, formatNumber, formatUsd, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';

import type { AdminAiView } from 'core/controllers/Admin';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/generacion/ia');
}

const PATHNAME = '/admin/generacion/ia';

/** Past this many models the chart gathers the rest in one bar; the table lists them all. */
const CHART_MODELS = 10;

/**
 * IA y modelos (`0068`): how often the text models were called over the period, with
 * how many tokens and at what cost, against the period before — per day, and by the
 * model that answered. Counts, tokens, clocks, dollars and model names; no person, no
 * prompt, no answer (`0028`).
 *
 * What the text models bill covers the dishes generated for plans and the nightly step
 * rewrites, which the events do not tell apart; pictures are billed apart, on Imágenes.
 */
export default async function AdminAiPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const [dictionary, locale, ai] = await Promise.all([getDictionary(), activeLocale(), serverApi<AdminAiView>(`/admin/ai?period=${period}`)]);

  if (!ai) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminAi;
  const { models, month, totals } = ai;
  const number = (value: number) => formatNumber(value, locale);
  const dollars = (value: number) => formatUsd(value, locale);
  const seconds = (ms: number) =>
    interpolate(common.seconds, { seconds: formatNumber(ms / 1000, locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) });
  const tokens = (key: string) => ai.tokensPerDay.series.find(series => series.key === key)?.values ?? [];
  const modelName = (model: { readonly model: string; readonly provider: string | null }) =>
    model.provider ? `${model.model} · ${model.provider}` : model.model;

  const charted = models.slice(0, CHART_MODELS);
  const rest = models.slice(CHART_MODELS);
  const chartLabels = [...charted.map(modelName), ...(rest.length > 0 ? [interpolate(t.others, { count: number(rest.length) })] : [])];
  const chartValues = [...charted.map(model => model.calls), ...(rest.length > 0 ? [rest.reduce((sum, model) => sum + model.calls, 0)] : [])];

  const percent = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 0, style: 'percent' });
  const monthSince = formatDate(month.monthStart.slice(0, 10), locale, { day: 'numeric', month: 'long' });
  const featureRows = month.byFeature.map(row => ({
    id: row.feature,
    cells: { calls: number(row.calls), cost: dollars(row.costUsd), feature: t.features[row.feature] }
  }));
  const uncosted = month.uncostedCalls === 1 ? t.uncosted.one : interpolate(t.uncosted.many, { count: number(month.uncostedCalls) });

  const rows = models.map(model => ({
    id: `${model.model}\u0000${model.provider ?? ''}`,
    cells: {
      averageMs: model.averageMs === null ? '—' : seconds(model.averageMs),
      calls: number(model.calls),
      cost: dollars(model.costUsd),
      failed: number(model.failed),
      input: number(model.inputTokens),
      model: modelName(model),
      output: number(model.outputTokens),
      reasoning: number(model.reasoningTokens)
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      <AdminSection note={interpolate(t.monthNote, { date: monthSince })} title={t.monthTitle}>
        <div className={styles.month}>
          {month.capUsd === undefined ? (
            <Card>
              <p className={styles.line}>{interpolate(t.monthSpent, { spent: dollars(month.spentUsd) })}</p>
              <p className={styles.line}>{t.monthNoCap}</p>
            </Card>
          ) : (
            <Card>
              <Gauge
                cap={month.capUsd}
                capLabel={t.cap}
                className={styles.chart}
                dataLabel={common.dataLabel}
                emptyLabel={t.monthEmpty}
                formatValue={dollars}
                labelsHeader={t.monthTitle}
                locale={locale}
                overLabel={t.over}
                title={t.monthChart}
                value={month.spentUsd}
                valueLabel={t.spent}
              />
            </Card>
          )}
          {month.share !== undefined && month.share >= 1 ? (
            <p className={styles.warning} data-over="true">
              {t.warnOver}
            </p>
          ) : month.sweepPaused && month.share !== undefined ? (
            <p className={styles.warning}>{interpolate(t.warnSweep, { share: percent(month.share) })}</p>
          ) : null}
          {month.uncostedCalls > 0 ? <p className={styles.line}>{uncosted}</p> : null}
          {month.capUsd === undefined ? null : <p className={styles.line}>{t.monthOnlyOnWarns}</p>}
        </div>
      </AdminSection>

      <AdminSection note={t.featureNote} title={t.featureTitle}>
        <div className={styles.stack}>
          <Card>
            <BarChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.featureEmpty}
              formatValue={dollars}
              labels={month.byFeature.map(row => t.features[row.feature])}
              labelsHeader={t.featureColumn}
              locale={locale}
              series={[{ name: t.columns.cost, values: month.byFeature.map(row => row.costUsd) }]}
              title={t.featureChart}
            />
          </Card>
          <Card className={`${styles.table} ${styles.featureTable}`}>
            <DataTable
              caption={t.featureTable}
              columns={[
                { header: t.featureColumn, key: 'feature' },
                { align: 'end', header: t.columns.calls, key: 'calls' },
                { align: 'end', header: t.columns.cost, key: 'cost' }
              ]}
              empty={t.featureEmpty}
              rows={featureRows}
            />
          </Card>
        </div>
      </AdminSection>

      <ul aria-label={t.tilesLabel} className={styles.tiles}>
        <Card as="li" padding="sm">
          <StatTile
            change={totals.calls}
            changeLabel={common.changeLabel}
            label={t.calls}
            locale={locale}
            sparkline={ai.callsPerDay.values}
            value={number(totals.calls.current)}
          />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            change={totals.failed}
            changeLabel={common.changeLabel}
            goodDirection="down"
            label={t.failed}
            locale={locale}
            value={number(totals.failed.current)}
          />
        </Card>
        {/* Spend is neither good nor bad news on its own, so its change stays grey. */}
        <Card as="li" padding="sm">
          <StatTile
            change={totals.costUsd}
            changeLabel={common.changeLabel}
            label={t.spend}
            locale={locale}
            sparkline={ai.spendPerDay.values}
            value={dollars(totals.costUsd.current)}
          />
        </Card>
        {/* A mean moves by its own amount, not by a share of itself: the tile states the
            previous one. No timed call is "—", never 0 s. */}
        <Card as="li" padding="sm">
          <StatTile
            label={t.averageMs}
            locale={locale}
            note={totals.averageMs.previous === null ? undefined : interpolate(t.averageNote, { seconds: seconds(totals.averageMs.previous) })}
            value={totals.averageMs.current === null ? '—' : seconds(totals.averageMs.current)}
          />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            change={totals.inputTokens}
            changeLabel={common.changeLabel}
            label={t.inputTokens}
            locale={locale}
            value={number(totals.inputTokens.current)}
          />
        </Card>
        <Card as="li" padding="sm">
          <StatTile
            change={totals.outputTokens}
            changeLabel={common.changeLabel}
            label={t.outputTokens}
            locale={locale}
            value={number(totals.outputTokens.current)}
          />
        </Card>
      </ul>

      <AdminSection title={t.trendsTitle}>
        <div className={styles.charts}>
          <Card>
            <LineChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.callsEmpty}
              labels={ai.callsPerDay.days}
              labelsHeader={common.day}
              locale={locale}
              series={[{ name: t.callsSeries, values: ai.callsPerDay.values }]}
              title={t.callsChart}
            />
          </Card>
          <Card>
            <LineChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.spendEmpty}
              formatValue={dollars}
              labels={ai.spendPerDay.days}
              labelsHeader={common.day}
              locale={locale}
              series={[{ name: t.spendSeries, values: ai.spendPerDay.values }]}
              title={t.spendChart}
            />
          </Card>
          <Card className={styles.wide}>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.tokensEmpty}
              labels={ai.tokensPerDay.days}
              labelsHeader={common.day}
              locale={locale}
              series={[
                { name: t.tokens.input, tone: 1, values: tokens('input') },
                { name: t.tokens.output, tone: 2, values: tokens('output') }
              ]}
              stacked={true}
              title={t.tokensChart}
              totalLabel={dictionary.adminSummary.total}
            />
          </Card>
        </div>
      </AdminSection>

      <AdminSection title={t.modelsTitle}>
        <div className={styles.stack}>
          <Card>
            <BarChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.modelsEmpty}
              labels={chartLabels}
              labelsHeader={t.columns.model}
              locale={locale}
              series={[{ name: t.columns.calls, values: chartValues }]}
              title={t.modelsChart}
            />
          </Card>
          <Card className={styles.table}>
            <DataTable
              caption={t.caption}
              columns={[
                { header: t.columns.model, key: 'model' },
                { align: 'end', header: t.columns.calls, key: 'calls' },
                { align: 'end', header: t.columns.failed, key: 'failed' },
                { align: 'end', header: t.columns.averageMs, key: 'averageMs' },
                { align: 'end', header: t.columns.input, key: 'input' },
                { align: 'end', header: t.columns.output, key: 'output' },
                { align: 'end', header: t.columns.reasoning, key: 'reasoning' },
                { align: 'end', header: t.columns.cost, key: 'cost' }
              ]}
              empty={t.modelsEmpty}
              rows={rows}
            />
          </Card>
        </div>
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
