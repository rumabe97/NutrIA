import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CareEndLink } from 'components/CareEndLink';
import { CareFortnightList } from 'components/CareFortnightList';
import { CareGenerateButton } from 'components/CareGenerateButton';
import { CarePlanDays } from 'components/CarePlanDays';
import { CarePublishButton } from 'components/CarePublishButton';
import { CareReviewSwitch } from 'components/CareReviewSwitch';
import { CareTargetsForm } from 'components/CareTargetsForm';
import { WeightChart } from 'components/WeightChart';

import { formatDate, formatInstant, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { CareClientOverviewView } from 'core/controllers/Care';
import type { Metadata } from 'next';
import type { PlanView } from 'core/controllers/Plan';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/consulta/[linkId]');
}

/**
 * One client's page, through their link (PRD 004, criteria 7–12; `0059`, `0060`).
 *
 * The path carries the **link** id and nothing else: the client's account id
 * never reaches this app. Every read and write is a `/care/*` route, each one
 * audited in the client's own trail, and a link that is not the caller's —
 * ended, paused, somebody else's, or not a link at all — is the same 404.
 *
 * Reading the plan under review leaves a `review` row too; it is read on every
 * visit because nothing cheaper says whether one is waiting.
 *
 * Health appears only when the client said yes to its separate line, and only
 * because the overview carries it (criterion 12) — never from anywhere else.
 */
export default async function ClientPage({ params }: Readonly<{ params: Promise<{ linkId: string }> }>) {
  const { linkId } = await params;
  const path = `/care/clients/${encodeURIComponent(linkId)}`;
  const [dictionary, locale, overview, pending] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<CareClientOverviewView>(path),
    serverApi<PlanView | null>(`${path}/plan/pending`)
  ]);

  if (!overview) {
    notFound();
  }

  const t = dictionary.practice;
  const { client, health, plan, plans, progress, targets } = overview;
  const today = new Date().toISOString().slice(0, 10);
  const dateOptions = { day: 'numeric', month: 'short' } as const;
  const range = (from: string, to: string) => ({ from: formatDate(from, locale, dateOptions), to: formatDate(to, locale, dateOptions) });
  // A new fortnight only where the server would start one: nothing waiting, and no plan or one whose fortnight has ended.
  // Never a way to replace a fortnight still running.
  const fortnightEnded = !plan || plan.endDate < today;
  const canStart = !pending && fortnightEnded;
  const kg = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 1 });

  return (
    <Fragment>
      <Link className={styles.back} href="/consulta">
        {t.back}
      </Link>

      <h1 className={styles.title}>{client.name}</h1>
      <div className={styles.meta}>
        <Text as="span" size="sm" tone="secondary">
          {interpolate(t.clientSince, { date: formatInstant(Date.parse(client.since), locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
        </Text>
        {client.sharesHealth ? <span className={styles.chip}>{t.sharesHealth}</span> : null}
      </div>

      <div className={styles.regions}>
        {/* What is waiting on the professional comes first. */}
        {pending ? (
          <Card aria-labelledby="pending-title" as="section" className={styles.stack}>
            <div>
              <h2 className={styles.cardTitle} id="pending-title" tabIndex={-1}>
                {t.pendingTitle}
              </h2>
              <Text size="sm" tone="secondary">
                {interpolate(dictionary.plan.range, {
                  end: formatDate(pending.endDate, locale, dateOptions),
                  start: formatDate(pending.startDate, locale, dateOptions)
                })}
              </Text>
              <Text size="sm" tone="tertiary">
                {t.pendingIntro}
              </Text>
            </div>

            <CarePlanDays linkId={client.linkId} plan={pending} />

            <div className={styles.actions}>
              <CarePublishButton linkId={client.linkId} />
              <CareGenerateButton hint={t.regenerateHint} label={t.regenerate} linkId={client.linkId} variant="secondary" />
            </div>
          </Card>
        ) : null}

        <Card aria-labelledby="plan-title" as="section" className={styles.stack}>
          <h2 className={styles.cardTitle} id="plan-title" tabIndex={-1}>
            {t.currentPlanTitle}
          </h2>

          {plan ? (
            <Text size="sm">
              {interpolate(dictionary.plan.range, {
                end: formatDate(plan.endDate, locale, dateOptions),
                start: formatDate(plan.startDate, locale, dateOptions)
              })}
            </Text>
          ) : (
            <Text size="sm" tone="secondary">
              {t.currentPlanNone}
            </Text>
          )}

          {/* Drawn disabled with its reason while a fortnight runs or a plan waits: the professional
              should know when it will open, not wonder where the button went. */}
          <CareGenerateButton
            disabled={!canStart}
            hint={
              pending
                ? t.newFortnightPending
                : !fortnightEnded && plan
                  ? interpolate(t.newFortnightRunning, { date: formatDate(plan.endDate, locale, { day: 'numeric', month: 'long' }) })
                  : client.reviewBeforePublish
                    ? t.newFortnightReview
                    : t.newFortnightDirect
            }
            label={t.newFortnight}
            linkId={client.linkId}
            variant={pending ? 'secondary' : 'primary'}
          />

          {plans.length > 0 ? (
            <Fragment>
              <h3 className={styles.subTitle}>{t.historyTitle}</h3>
              <ul className={styles.rows}>
                {plans.map(summary => (
                  <li className={styles.row} key={summary.id}>
                    <span>{interpolate(t.historyItem, { version: summary.version, ...range(summary.startDate, summary.endDate) })}</span>
                    <span className={styles.rowValue}>
                      {summary.replaced
                        ? t.historyStatus.replaced
                        : (t.historyStatus[summary.status as keyof typeof t.historyStatus] ?? summary.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </Fragment>
          ) : null}
        </Card>

        <Card aria-labelledby="progress-title" as="section" className={styles.stack}>
          <h2 className={styles.cardTitle} id="progress-title">
            {t.fortnightsTitle}
          </h2>
          <Text size="sm" tone="secondary">
            {progress.overall.adherence === null
              ? t.overallNone
              : `${formatNumber(progress.overall.adherence, locale)} % · ${interpolate(t.overallLine, {
                  eaten: formatNumber(progress.overall.eaten, locale),
                  marked: formatNumber(progress.overall.marked, locale)
                })}`}
          </Text>
          {progress.fortnights.length > 0 ? (
            <CareFortnightList fortnights={progress.fortnights} />
          ) : (
            <Text size="sm" tone="tertiary">
              {t.fortnightsEmpty}
            </Text>
          )}
        </Card>

        <Card aria-labelledby="weight-title" as="section" className={styles.stack}>
          <h2 className={styles.cardTitle} id="weight-title">
            {t.weightTitle}
          </h2>
          {progress.weight.latestKg === null ? (
            <Text size="sm" tone="tertiary">
              {t.weightNone}
            </Text>
          ) : (
            <Fragment>
              <p className={styles.figure}>
                {kg(progress.weight.latestKg)} {dictionary.units.kilogram}
              </p>
              <WeightChart entries={progress.weight.entries} targetKg={progress.weight.targetWeightKg} />
            </Fragment>
          )}
        </Card>

        {targets ? <CareTargetsForm linkId={client.linkId} targets={targets} /> : null}

        <Card aria-labelledby="review-title" as="section" className={styles.stack}>
          <h2 className={styles.cardTitle} id="review-title">
            {t.reviewTitle}
          </h2>
          <CareReviewSwitch enabled={client.reviewBeforePublish} linkId={client.linkId} />
        </Card>

        {health ? (
          <Card aria-labelledby="health-title" as="section" className={styles.stack}>
            <div>
              <h2 className={styles.cardTitle} id="health-title">
                {t.healthTitle}
              </h2>
              <Text size="sm" tone="tertiary">
                {t.healthIntro}
              </Text>
            </div>
            <dl className={styles.health}>
              {[
                { label: t.healthConditions, values: health.conditions.map(condition => condition.label) },
                { label: t.healthMedications, values: health.medications.map(medication => medication.name) },
                { label: t.healthSupplements, values: health.supplements.map(supplement => supplement.name) }
              ].map(row => (
                <div className={styles.healthRow} key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.values.length > 0 ? row.values.join(', ') : t.healthNone}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}

        <Card aria-labelledby="end-title" as="section" className={styles.stack}>
          <h2 className={styles.cardTitle} id="end-title">
            {t.end}
          </h2>
          <CareEndLink linkId={client.linkId} name={client.name} />
        </Card>
      </div>
    </Fragment>
  );
}
