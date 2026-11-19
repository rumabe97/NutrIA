import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { CountUp } from 'ui/components/CountUp';
import { Note } from 'ui/components/Note';
import { Rings } from 'ui/components/Rings';
import { Text } from 'ui/components/Text';

import { BackLabel } from 'components/BackLabel';
import { Card } from 'components/Card';
import { CareEndLink } from 'components/CareEndLink';
import { CareFortnightList } from 'components/CareFortnightList';
import { CareGenerateButton } from 'components/CareGenerateButton';
import { CarePlanDays } from 'components/CarePlanDays';
import { CarePublishButton } from 'components/CarePublishButton';
import { CareReviewSwitch } from 'components/CareReviewSwitch';
import { CareTargetsForm } from 'components/CareTargetsForm';
import { WeightChart } from 'components/WeightChart';

import { badgeStands } from 'lib/badgeState';
import { formatDate, formatInstant, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { BadgeView } from 'core/controllers/Professional';
import type { CareClientPageView, CareClientPlanView } from 'core/controllers/Care';
import type { Metadata } from 'next';

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
 *
 * **Two pages, by the link's scope** (PRD 025 criterion 9; sheet «Cliente»): the
 * full page, or — under a `plan` scope — the plans made through this link and
 * nothing else: no progress, weight, targets or health card is drawn, not even
 * empty, because the answer has no such keys (`'progress' in page`). A
 * practitioner without the badge reads the fixed sentence of `textos/01` § P4
 * there.
 */
export default async function ClientPage({ params }: Readonly<{ params: Promise<{ linkId: string }> }>) {
  const { linkId } = await params;
  const path = `/care/clients/${encodeURIComponent(linkId)}`;
  const [dictionary, locale, overview, pending, badge] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<CareClientPageView>(path),
    serverApi<CareClientPlanView | null>(`${path}/plan/pending`),
    serverApi<BadgeView>('/care/practice/badge')
  ]);

  if (!overview) {
    notFound();
  }

  const t = dictionary.practice;
  const { client, plan, plans } = overview;
  // The full page carries `progress`; the plan-only one has no such key (`CareClientPageView`).
  const full = 'progress' in overview ? overview : null;
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
        <BackLabel text={t.back} />
      </Link>

      <div className="motion-enter">
        <h1 className={styles.title}>{client.name}</h1>
        <div className={styles.meta}>
          <Text as="span" size="sm" tone="secondary">
            {interpolate(t.clientSince, {
              date: formatInstant(Date.parse(client.since), locale, { day: 'numeric', month: 'long', year: 'numeric' })
            })}
          </Text>
          {client.sharesHealth ? <span className={styles.chip}>{t.sharesHealth}</span> : null}
        </div>
      </div>

      {!full && badge && !badgeStands(badge) ? (
        <Note as="p" className={styles.notice} tone="info" toneLabel={dictionary.common.noteTone.info}>
          {t.unverifiedSelf}
        </Note>
      ) : null}

      {/* One column on a phone; two from a wide screen, in the same order, the plan to review
          across both. The cards arrive one after another. */}
      <div className={`${styles.regions} motion-list`}>
        {/* What is waiting on the professional comes first. */}
        {pending ? (
          <Card aria-labelledby="pending-title" as="section" className={`${styles.stack} ${styles.wide}`}>
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
                    <span>
                      {'version' in summary
                        ? interpolate(t.historyItem, { version: summary.version, ...range(summary.startDate, summary.endDate) })
                        : interpolate(t.fortnightRange, range(summary.startDate, summary.endDate))}
                    </span>
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

        {full ? (
          <Fragment>
            <Card aria-labelledby="progress-title" as="section" className={styles.stack}>
              <h2 className={styles.cardTitle} id="progress-title">
                {t.fortnightsTitle}
              </h2>
              {/* The share of marked meals that were done, as a ring beside the sentence that says
              it (the sentence is the text; the ring only its picture), as on the client's own
              Progreso. Nothing marked: the sentence alone, and no empty ring. */}
              <div className={styles.overall}>
                {full.progress.overall.adherence === null ? null : (
                  <Rings
                    className={styles.ring}
                    decorative={true}
                    items={[{ label: t.fortnightsTitle, max: full.progress.overall.marked, tone: 2, value: full.progress.overall.eaten }]}
                    label={t.fortnightsTitle}
                    size="sm"
                  />
                )}
                <Text className={styles.overallLine} size="sm" tone="secondary">
                  {full.progress.overall.adherence === null
                    ? t.overallNone
                    : `${formatNumber(full.progress.overall.adherence, locale)} % · ${interpolate(t.overallLine, {
                        eaten: formatNumber(full.progress.overall.eaten, locale),
                        marked: formatNumber(full.progress.overall.marked, locale)
                      })}`}
                </Text>
              </div>
              {full.progress.fortnights.length > 0 ? (
                <CareFortnightList fortnights={full.progress.fortnights} />
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
              {full.progress.weight.latestKg === null ? (
                <Text size="sm" tone="tertiary">
                  {t.weightNone}
                </Text>
              ) : (
                <Fragment>
                  <p className={styles.figure}>
                    <CountUp
                      format={{ maximumFractionDigits: 1 }}
                      locale={locale}
                      text={kg(full.progress.weight.latestKg)}
                      value={full.progress.weight.latestKg}
                    />{' '}
                    {dictionary.units.kilogram}
                  </p>
                  <WeightChart entries={full.progress.weight.entries} targetKg={full.progress.weight.targetWeightKg} />
                </Fragment>
              )}
            </Card>
          </Fragment>
        ) : null}

        {full?.targets ? <CareTargetsForm linkId={client.linkId} targets={full.targets} /> : null}

        <Card aria-labelledby="review-title" as="section" className={styles.stack}>
          <h2 className={styles.cardTitle} id="review-title">
            {t.reviewTitle}
          </h2>
          <CareReviewSwitch enabled={client.reviewBeforePublish} linkId={client.linkId} />
        </Card>

        {full?.health ? (
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
                { label: t.healthConditions, values: full.health.conditions.map(condition => condition.label) },
                { label: t.healthMedications, values: full.health.medications.map(medication => medication.name) },
                { label: t.healthSupplements, values: full.health.supplements.map(supplement => supplement.name) }
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
