import { Fragment } from 'react';

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import type { AdminOverviewView } from 'core/controllers/Admin';

export const dynamic = 'force-dynamic';

/**
 * The owner's window on their own service.
 *
 * Reachable only by an account whose stored role is `admin`; the API answers
 * everyone else 404, and so does this page, so the route does not confirm
 * itself to anyone who guesses it. There is no link to it anywhere: the person
 * who needs it knows the address.
 *
 * It shows no plan, no profile and no email on purpose. "Is generation working"
 * and "how big is the catalogue" are answerable without reading anybody's food.
 */
export default async function AdminPage() {
  const [dictionary, locale, overview] = await Promise.all([getDictionary(), activeLocale(), serverApi<AdminOverviewView>('/admin/overview')]);

  if (!overview) {notFound();}

  const t = dictionary.admin;
  const { counts, jobs, windowDays } = overview;
  const number = (value: number) => formatNumber(value, locale);
  const failures = jobs.filter(job => job.status === 'failed');
  const tiles = [
    { label: t.accounts, note: interpolate(t.waiting, { count: number(counts.accounts.waiting) }), value: number(counts.accounts.total) },
    { label: t.recipes, note: interpolate(t.withoutImage, { count: number(counts.catalogue.withoutImage) }), value: number(counts.catalogue.recipes) },
    { label: t.ingredients, note: null, value: number(counts.catalogue.ingredients) },
    { label: t.failures, note: interpolate(t.inDays, { days: number(windowDays) }), value: number(counts.jobs.find(row => row.status === 'failed')?.n ?? 0) }
  ];

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      <Text className={styles.intro} tone="secondary">
        {t.intro}
      </Text>

      <dl className={styles.tiles}>
        {tiles.map(tile => (
          <div className={styles.tile} key={tile.label}>
            <dt className={styles.tileLabel}>{tile.label}</dt>
            <dd className={styles.tileValue}>{tile.value}</dd>
            {tile.note ? (
              <Text as="p" className={styles.tileNote} size="xs" tone="tertiary">
                {tile.note}
              </Text>
            ) : null}
          </div>
        ))}
      </dl>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>{t.plansTitle}</h2>
        <ul className={styles.rows}>
          {counts.plans.map(row => (
            <li className={styles.row} key={row.status}>
              <span>{row.status}</span>
              <span className={styles.count}>{number(row.n)}</span>
            </li>
          ))}
        </ul>
      </section>

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
    </Fragment>
  );
}
