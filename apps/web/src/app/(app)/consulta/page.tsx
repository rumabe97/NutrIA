import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CareInviteForm } from 'components/CareInviteForm';
import { PracticeAgreement } from 'components/PracticeAgreement';
import { PracticePlanCard } from 'components/PracticePlanCard';

import { formatInstant, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { CareClientsView, CarePracticeView } from 'core/controllers/Care';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/consulta');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until an instant, counted up: "1 day left" on a trial's last afternoon, never "0". */
function daysUntil(iso: string): number {
  return Math.max(Math.ceil((Date.parse(iso) - Date.now()) / DAY_MS), 0);
}

/**
 * The professional's workspace (PRD 004, criterion 9; `0059`, `0061`).
 *
 * Shown only to a professional: `GET /care/practice` answers everybody else
 * 404, and so does this page, as `/admin` does — the route does not confirm
 * itself to anyone who guesses it. With the practice closed it shows only the
 * plan card: the client routes are closed until it is paid for, so there is
 * no list to read and nobody to invite.
 *
 * Before either of those, `practice.agreementRequired` shows `PracticeAgreement`
 * in place of the whole workspace — the professional's agreement and the
 * practice plan's conditions, one checkbox for both
 * (`docs/legal/textos/01-acuerdo-profesional.md`). Nothing past that gate is
 * reachable until it posts back.
 *
 * Every link here carries a link id and never a client's account id; the list
 * is read once per visit because each read leaves a row in every active
 * client's trail.
 */
export default async function PracticePage({ searchParams }: Readonly<{ searchParams: Promise<{ practica?: string }> }>) {
  const [dictionary, locale, practice, query] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<CarePracticeView>('/care/practice'),
    searchParams
  ]);

  if (!practice) {
    notFound();
  }

  // The agreement gates the whole workspace (`docs/legal/textos/01-acuerdo-profesional.md`):
  // nothing below this — the roster, the invite form, subscribing — is reachable until it is
  // accepted. The API enforces the same rule on every client route; this is the screen for it.
  if (practice.agreementRequired) {
    return <PracticeAgreement version={practice.agreementVersion} />;
  }

  const t = dictionary.practice;
  const roster = practice.open ? await serverApi<CareClientsView>('/care/clients') : null;
  const subscription = practice.billing.available ? practice.billing.subscription : null;
  const trialDaysLeft = subscription?.status === 'trialing' && subscription.currentPeriodEnd ? daysUntil(subscription.currentPeriodEnd) : null;
  const shortDate = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Fragment>
      <h1 className={styles.title}>{t.title}</h1>
      <Text className={styles.intro} tone="secondary">
        {t.intro}
      </Text>

      <div className={styles.regions}>
        {/* `?practica=gracias` is where Stripe's checkout sends a professional back to. */}
        <PracticePlanCard justPaid={query.practica === 'gracias'} practice={practice} trialDaysLeft={trialDaysLeft} />

        {roster ? (
          <section aria-labelledby="clients-title" className={styles.region}>
            <h2 className={styles.regionTitle} id="clients-title">
              {t.clientsTitle}
            </h2>

            {roster.clients.length === 0 ? (
              <Text size="sm" tone="secondary">
                {t.clientsEmpty}
              </Text>
            ) : (
              <ul className={styles.clients}>
                {roster.clients.map(client => {
                  const body = (
                    <Fragment>
                      <span className={styles.clientName}>{client.name}</span>
                      <span className={styles.clientMeta}>
                        <span className={styles.stage} data-stage={client.stage ?? 'paused'}>
                          {client.stage ? t.stages[client.stage] : t.paused}
                        </span>
                        {client.sharesHealth ? <span className={styles.chip}>{t.sharesHealth}</span> : null}
                      </span>
                      <Text as="span" size="xs" tone="tertiary">
                        {interpolate(t.clientSince, { date: shortDate(client.since) })}
                      </Text>
                    </Fragment>
                  );

                  return (
                    <li key={client.linkId}>
                      {/* A paused link opens nothing — its page is closed until the practice is paid for again. */}
                      {client.status === 'active' ? (
                        <Card as={Link} className={styles.client} href={`/consulta/${encodeURIComponent(client.linkId)}`} padding="sm">
                          {body}
                        </Card>
                      ) : (
                        <Card className={styles.client} padding="sm">
                          {body}
                          <Text as="span" size="xs" tone="secondary">
                            {t.pausedHint}
                          </Text>
                        </Card>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {roster ? <CareInviteForm /> : null}

        {roster && roster.invitations.length > 0 ? (
          <section aria-labelledby="invitations-title" className={styles.region}>
            <h2 className={styles.regionTitle} id="invitations-title">
              {t.invitationsTitle}
            </h2>
            <ul className={styles.invitations}>
              {roster.invitations.map(invitation => (
                <li className={styles.invitation} key={`${invitation.email}·${invitation.expiresAt}`}>
                  <span className={styles.email}>{invitation.email}</span>
                  <Text as="span" size="xs" tone="tertiary">
                    {interpolate(t.invitationExpires, { date: shortDate(invitation.expiresAt) })}
                  </Text>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {practice.agreementAcceptedAt ? (
        <Text className={styles.agreement} size="xs" tone="tertiary">
          {interpolate(dictionary.practiceAgreement.acceptedOn, {
            date: shortDate(practice.agreementAcceptedAt),
            version: practice.agreementVersion
          })}
        </Text>
      ) : null}
    </Fragment>
  );
}
