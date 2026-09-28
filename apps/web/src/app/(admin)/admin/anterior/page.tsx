import { Fragment } from 'react';

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AdminGenerationView, AdminOverviewView, AdminPicturesView, AiUsageView } from 'core/controllers/Admin';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/anterior');
}

/**
 * The owner's window on their own service.
 *
 * Reachable only by an account whose stored role is `admin`; the API answers
 * everyone else 404, and so does this page, so the route does not confirm
 * itself to anyone who guesses it. Only the console's own menu links to it:
 * nothing in the app does.
 *
 * It shows no plan and no profile on purpose. "Is generation working" and "how
 * big is the catalogue" are answerable without reading anybody's food. The
 * read that names somebody — the address on each generation in the log — comes
 * from an endpoint of its own (`0028`, `0050`).
 *
 * What the console's own pages already show has left: the accounts and failure
 * tiles, the funnel, the activity and the plans live on Resumen, Embudo y
 * actividad and Planes; the accounts, the professionals and the inbox, with the
 * `?abierta=` banner, on Cuentas, Profesionales and Buzón. The catalogue counts,
 * the pictures, the AI figures, the recent jobs and the log stay until their pages
 * exist (phase 8).
 */
export default async function AdminPage() {
  const [dictionary, locale, overview, ai, generations, pictures] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<AdminOverviewView>('/admin/overview'),
    serverApi<AiUsageView>('/admin/ai'),
    serverApi<readonly AdminGenerationView[]>('/admin/generations?legacy=1'),
    serverApi<AdminPicturesView>('/admin/pictures')
  ]);

  if (!overview) {
    notFound();
  }

  const t = dictionary.admin;
  const { counts, jobs, windowDays } = overview;
  const number = (value: number) => formatNumber(value, locale);
  const dollars = (value: number) => formatNumber(value, locale, { currency: 'USD', style: 'currency' });
  // Milliseconds as seconds with one decimal, which is the grain a model call is felt at.
  const seconds = (ms: number | null) => (ms === null ? '—' : number(Math.round(ms / 100) / 10));
  const failures = jobs.filter(job => job.status === 'failed');
  const tiles = [
    {
      label: t.recipes,
      note: interpolate(t.withoutImage, { count: number(counts.catalogue.withoutImage) }),
      value: number(counts.catalogue.recipes)
    },
    { label: t.ingredients, note: null, value: number(counts.catalogue.ingredients) }
  ];

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      <Text className={styles.intro} tone="secondary">
        {t.intro}
      </Text>

      <dl className={styles.tiles}>
        {tiles.map(tile => (
          <Card className={styles.tile} key={tile.label} padding="sm">
            <dt className={styles.tileLabel}>{tile.label}</dt>
            <dd className={styles.tileValue}>{tile.value}</dd>
            {tile.note ? (
              <Text as="p" className={styles.tileNote} size="xs" tone="tertiary">
                {tile.note}
              </Text>
            ) : null}
          </Card>
        ))}
      </dl>

      {/* Dish pictures (`0066`): whether a dish is drawn when first opened, and this
          month's spend against the cap. Counts only — no dish, no person. */}
      <section className={styles.section} id="imagenes">
        <h2 className={styles.subtitle}>{t.picturesTitle}</h2>
        {pictures ? (
          <ul className={styles.rows}>
            <li className={styles.row}>
              <span>{t.picturesSpend}</span>
              <span className={`${styles.count} ${styles.whole}`}>
                {interpolate(t.picturesSpendValue, { cap: dollars(pictures.capUsd), spent: dollars(pictures.spentUsd) })}
              </span>
            </li>
            <li className={styles.row}>
              <span>{t.picturesReady}</span>
              <span className={styles.count}>{number(pictures.ready)}</span>
            </li>
            <li className={styles.row}>
              <span>{t.picturesFailed}</span>
              <span className={styles.count}>{number(pictures.failed)}</span>
            </li>
            <li className={styles.row}>
              <span>{t.picturesDrawing}</span>
              <span className={styles.count}>{number(pictures.drawing)}</span>
            </li>
            {pictures.released > 0 ? (
              <li className={styles.row}>
                <span>{t.picturesReleased}</span>
                <span className={styles.count}>{number(pictures.released)}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {ai ? (
        <section className={styles.section} id="ia">
          <h2 className={styles.subtitle}>{t.aiTitle}</h2>
          <Text className={styles.hint} size="sm" tone="tertiary">
            {t.aiHint}
          </Text>

          <ul className={styles.rows}>
            <li className={styles.row}>
              <span>{t.aiCalls}</span>
              <span className={styles.count}>
                {number(ai.calls)}
                {ai.limits.requestsPerDay === null ? '' : ` / ${number(ai.limits.requestsPerDay)}`}
              </span>
            </li>
            {ai.refused > 0 ? (
              <li className={styles.row}>
                <span>{t.aiRefused}</span>
                <span className={styles.count}>{number(ai.refused)}</span>
              </li>
            ) : null}
            <li className={styles.row}>
              <span>{t.aiTokens}</span>
              <span className={styles.count}>{`${number(ai.inputTokens)} / ${number(ai.outputTokens)}`}</span>
            </li>
            <li className={styles.row}>
              <span>{t.aiResets}</span>
              <span className={styles.count}>
                {formatDate(ai.resetsAt.slice(0, 10), locale, { day: 'numeric', month: 'short' })} · {ai.resetsAt.slice(11, 16)} UTC
              </span>
            </li>
            {ai.model ? (
              <li className={styles.row}>
                <span>{t.aiModel}</span>
                <span className={styles.count}>{ai.model}</span>
              </li>
            ) : null}
            {ai.lastRefusal ? (
              <li className={styles.row}>
                <span>{t.aiLastRefusal}</span>
                <span className={styles.count}>
                  {interpolate(t.aiLastRefusalValue, {
                    limit: ai.lastRefusal.limit === null ? '?' : number(ai.lastRefusal.limit),
                    model: ai.lastRefusal.model,
                    seconds: ai.lastRefusal.retryAfterSeconds === null ? '?' : number(ai.lastRefusal.retryAfterSeconds),
                    time: ai.lastRefusal.at.slice(11, 16)
                  })}
                </span>
              </li>
            ) : null}
          </ul>

          {/* Through a gateway the name asked for is a combo; the allowance went to
              whatever answered, and that is the row that says so. */}
          {ai.byModel.length > 0 ? (
            <Fragment>
              <h3 className={styles.subtitle}>{t.aiByModel}</h3>
              <ul className={styles.rows}>
                {ai.byModel.map(row => (
                  <li className={styles.row} key={`${row.model}·${row.provider ?? ''}`}>
                    <span>{row.provider ? `${row.model} · ${row.provider}` : row.model}</span>
                    <span className={styles.count}>
                      {interpolate(t.aiModelUsage, {
                        calls: number(row.calls),
                        failed: number(row.failed),
                        input: number(row.inputTokens),
                        output: number(row.outputTokens),
                        seconds: seconds(row.averageMs)
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </Fragment>
          ) : null}
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.subtitle}>{interpolate(t.jobsTitle, { days: number(windowDays) })}</h2>

        {jobs.length === 0 ? (
          <Text tone="secondary">{t.noJobs}</Text>
        ) : (
          <ul className={styles.jobs}>
            {jobs.map(job => (
              <li className={styles.job} data-status={job.status} key={job.id}>
                <span className={styles.jobStatus}>{job.status}</span>
                <span className={styles.jobWhen}>
                  {job.startedAt ? formatDate(job.startedAt.slice(0, 10), locale, { day: 'numeric', month: 'short' }) : '—'}
                  {job.seconds === null ? '' : ` · ${number(job.seconds)} s`}
                  {job.attempts > 1 ? ` · ${interpolate(t.attempts, { count: number(job.attempts) })}` : ''}
                </span>
                {/* The stable code and the provider's own redacted message: the two
                    things that say whether it was the key, the quota or the pool. */}
                <span className={styles.jobCode}>{job.code ?? job.step ?? ''}</span>
                {job.detail ? <span className={styles.jobDetail}>{job.detail}</span> : null}
              </li>
            ))}
          </ul>
        )}

        {failures.length > 0 ? (
          <Text className={styles.hint} size="sm" tone="tertiary">
            {interpolate(t.failureNote, { count: number(failures.length) })}
          </Text>
        ) : null}
      </section>

      {/* The log: each generation with who asked, and every call it made to a
          model — the calls folded away until somebody needs them. */}
      {generations ? (
        <section className={styles.section} id="registro">
          <h2 className={styles.subtitle}>{t.logTitle}</h2>
          <Text className={styles.hint} size="sm" tone="tertiary">
            {t.logHint}
          </Text>

          {generations.length === 0 ? (
            <Text tone="secondary">{t.logEmpty}</Text>
          ) : (
            <ul className={styles.jobs}>
              {generations.map(generation => (
                <li className={styles.job} data-status={generation.status} key={generation.id}>
                  <span className={styles.jobStatus}>{generation.status}</span>
                  <span className={styles.jobWhen}>
                    {generation.account.email}
                    {generation.startedAt
                      ? ` · ${formatDate(generation.startedAt.slice(0, 10), locale, { day: 'numeric', month: 'short' })} ${generation.startedAt.slice(11, 16)} UTC`
                      : ''}
                    {generation.seconds === null ? '' : ` · ${number(generation.seconds)} s`}
                  </span>
                  {generation.plan ? (
                    <span className={styles.jobCode}>
                      {interpolate(t.logPlan, {
                        model: generation.plan.model ?? '—',
                        prompt: generation.plan.promptVersion ?? '—',
                        reused: number(generation.plan.reused ?? 0),
                        version: number(generation.plan.version)
                      })}
                    </span>
                  ) : null}
                  {generation.code ? <span className={styles.jobCode}>{generation.code}</span> : null}
                  {generation.detail ? <span className={styles.jobDetail}>{generation.detail}</span> : null}

                  {generation.calls.length === 0 ? (
                    <span className={styles.jobDetail}>{t.logNoCalls}</span>
                  ) : (
                    <details className={styles.calls}>
                      <summary>{interpolate(t.logCalls, { count: number(generation.calls.length) })}</summary>
                      <ol className={styles.callList}>
                        {generation.calls.map(call => {
                          const answered = call.answeredModel ?? call.model;
                          const dropped = Object.entries(call.rejected)
                            .map(([reason, count]) => `${t.rejection[reason as keyof typeof t.rejection]} ${number(count)}`)
                            .join(', ');

                          return (
                            <li className={styles.call} data-failed={call.error ? 'true' : undefined} key={`${call.round}-${call.slot}`}>
                              <span>
                                {interpolate(t.logCall, { model: answered, round: number(call.round), slot: dictionary.slots[call.slot] })}
                                {answered === call.model ? '' : ` (${interpolate(t.logCallAsked, { model: call.model })})`}
                                {call.provider ? ` · ${interpolate(t.logCallVia, { provider: call.provider })}` : ''}
                                {call.ms === null ? '' : ` · ${seconds(call.ms)} s`}
                              </span>
                              {call.error ? (
                                <span>
                                  {interpolate(t.logCallFailed, { status: call.error.status === null ? '—' : String(call.error.status) })}
                                  {call.error.quota
                                    ? ` · ${interpolate(t.logCallQuota, {
                                        limit: call.error.quota.limit === null ? '?' : number(call.error.quota.limit),
                                        seconds: call.error.quota.retryAfterSeconds === null ? '?' : number(call.error.quota.retryAfterSeconds)
                                      })}`
                                    : ''}
                                  {` · ${call.error.message}`}
                                </span>
                              ) : (
                                <span>
                                  {interpolate(t.logCallTokens, { input: number(call.inputTokens ?? 0), output: number(call.outputTokens ?? 0) })}
                                  {call.reasoningTokens ? ` (${interpolate(t.logCallReasoning, { count: number(call.reasoningTokens) })})` : ''}
                                  {` · ${interpolate(t.logCallKept, { dishes: number(call.dishes), kept: number(call.kept) })}`}
                                  {dropped ? ` · ${interpolate(t.logCallDropped, { reasons: dropped })}` : ''}
                                </span>
                              )}
                              {call.requestId ? (
                                <span className={styles.callIds}>{interpolate(t.logCallIds, { request: call.requestId })}</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </Fragment>
  );
}
