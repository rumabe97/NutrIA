import { Fragment } from 'react';

import { notFound } from 'next/navigation';
import Link from 'next/link';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';

import { Card } from 'components/Card';
import { CareInviteForm } from 'components/CareInviteForm';
import { PracticeAgreement } from 'components/PracticeAgreement';
import { PracticeOpen } from 'components/PracticeOpen';
import { PracticePlanCard } from 'components/PracticePlanCard';
import { PracticeRestriction } from 'components/PracticeRestriction';
import { PracticeSeats } from 'components/PracticeSeats';
import { SecondFactorRequired } from 'components/SecondFactorRequired';

import { badgeSentence, badgeStands } from 'lib/badgeState';
import { formatInstant, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../_shared/metadata';

import type { BadgeView, ProfessionalProfileView } from 'core/controllers/Professional';
import type { CareClientsView, CarePracticeView } from 'core/controllers/Care';
import type { FullProfileView } from 'core/controllers/Profile';
import type { Metadata } from 'next';
import type { UserView } from 'core/controllers/User';

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
 * The practitioner's workspace (PRD 004 criterion 9; PRD 025; sheet «Clientes»).
 *
 * **No practice yet**: `GET /care/practice` answers 404. The opening form
 * (`PracticeOpen`, sheet «AbrirConsulta») is drawn only while
 * `UserView.canOpenPractice` says the door exists; otherwise this page is the
 * same 404 it has always been — the route does not confirm itself to anyone
 * who guesses it, and no form stands behind a switch that is off.
 *
 * Then, in order: the second factor (PLAN 011 phase 6), the professional's
 * agreement at its current version (`docs/legal/textos/01`, 2.0.0), and the
 * workspace — what the owner has standing against it, the fixed sentence for a
 * practitioner without the badge, the places (a free practice) or the paid
 * plan's card (a paid one: payments are deferred, not removed), the clients,
 * the invitation form, the unanswered invitations, and the way to the profile
 * and the badge. Under a suspension `/care/clients` answers 404: the clients,
 * the form and the invitations are simply not drawn.
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
    const user = await serverApi<UserView>('/users/me');

    if (!user?.canOpenPractice) {
      notFound();
    }

    // The birth date is asked only when none is on record (PRD 025 criterion 1).
    const profile = await serverApi<FullProfileView>('/profile');

    return <PracticeOpen askBirthDate={!profile?.profile?.birthDate} />;
  }

  // A password account with no second factor reaches no client (PLAN 011 phase 6): the API
  // answers 404 on every client route, and this says how to open them — before the agreement,
  // which needs nothing of it, because nothing behind the agreement would open anyway.
  if (practice.secondFactorRequired) {
    return <SecondFactorRequired where="practice" />;
  }

  // The agreement gates the whole workspace: nothing below is reachable until it is accepted.
  // A restriction is said above it too, so it is never behind a step the practitioner must take.
  if (practice.agreementRequired) {
    return (
      <Fragment>
        {practice.restriction ? <PracticeRestriction restriction={practice.restriction} /> : null}
        <PracticeAgreement version={practice.agreementVersion} />
      </Fragment>
    );
  }

  const t = dictionary.practice;
  const [roster, badge, profile] = await Promise.all([
    serverApi<CareClientsView>('/care/clients'),
    serverApi<BadgeView>('/care/practice/badge'),
    serverApi<ProfessionalProfileView | null>('/care/practice/profile')
  ]);
  const subscription = practice.billing.available ? practice.billing.subscription : null;
  const trialDaysLeft = subscription?.status === 'trialing' && subscription.currentPeriodEnd ? daysUntil(subscription.currentPeriodEnd) : null;
  const shortDate = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const review = profile ? (profile.hidden ? t.profileReviewState.hidden : t.profileReviewState[profile.review]) : null;
  // A refusal or a withdrawal is a practice without the badge: the long statement is the badge page's.
  const badgeLine = badge
    ? badge.state === 'refused' || badge.state === 'withdrawn'
      ? t.badgeState.none
      : badgeSentence(badge, t, shortDate)
    : null;

  return (
    <Fragment>
      <div className="motion-enter">
        <h1 className={styles.title}>{t.title}</h1>
        <Text className={styles.intro} tone="secondary">
          {t.intro}
        </Text>
      </div>

      {practice.restriction ? <PracticeRestriction restriction={practice.restriction} /> : null}

      {/* The fixed sentence of `textos/01` § P4, for as long as no badge stands. */}
      {badge && !badgeStands(badge) ? (
        <Note as="p" className={styles.notice} tone="info" toneLabel={dictionary.common.noteTone.info}>
          {t.unverifiedSelf}
        </Note>
      ) : null}

      {/* One column on a phone, in this order. From a wide screen the clients and the
          invitations are the main column and the places, the invite form and the way to the
          profile and the badge the side: the same order read down the page. */}
      <div className={`${styles.regions} motion-list`}>
        <div className={styles.side}>
          {practice.open ? (
            // A paid practice keeps its plan's card as it was; a free one has nothing to buy.
            <PracticePlanCard justPaid={query.practica === 'gracias'} practice={practice} trialDaysLeft={trialDaysLeft} />
          ) : (
            <PracticeSeats activeClients={practice.activeClients} pendingInvitations={practice.pendingInvitations} seats={practice.seats} />
          )}
        </div>

        {roster ? (
          <section aria-labelledby="clients-title" className={`${styles.region} ${styles.main}`}>
            <h2 className={styles.regionTitle} id="clients-title">
              {t.clientsTitle}
            </h2>

            {roster.clients.length === 0 ? (
              <Text size="sm" tone="secondary">
                {t.clientsEmpty}
              </Text>
            ) : (
              <Card as="ul" className={styles.rows}>
                {roster.clients.map(client => {
                  const body = (
                    <span className={styles.rowText}>
                      <span className={styles.clientName}>{client.name}</span>
                      <Text as="span" size="sm" tone="secondary">
                        {client.stage ? t.stages[client.stage] : t.paused}
                      </Text>
                      <Text as="span" size="xs" tone="tertiary">
                        {interpolate(t.clientSince, { date: shortDate(client.since) })}
                      </Text>
                      {client.sharesHealth ? <span className={styles.chip}>{t.sharesHealth}</span> : null}
                    </span>
                  );

                  return (
                    <li className={styles.rowItem} key={client.linkId}>
                      {/* A paused link opens nothing: its page is closed while it is paused. */}
                      {client.status === 'active' ? (
                        <Link className={styles.row} href={`/consulta/${encodeURIComponent(client.linkId)}`}>
                          {body}
                          <span aria-hidden="true" className={styles.chevron} />
                        </Link>
                      ) : (
                        <div className={styles.row}>
                          {body}
                          <Text as="span" className={styles.rowAside} size="xs" tone="secondary">
                            {t.pausedHint}
                          </Text>
                        </div>
                      )}
                    </li>
                  );
                })}
              </Card>
            )}
          </section>
        ) : null}

        {roster ? (
          <div className={styles.side}>
            <CareInviteForm paid={practice.open} seats={practice.seats} />
          </div>
        ) : null}

        {roster && roster.invitations.length > 0 ? (
          <section aria-labelledby="invitations-title" className={`${styles.region} ${styles.main}`}>
            <h2 className={styles.regionTitle} id="invitations-title">
              {t.invitationsTitle}
            </h2>
            <Card as="ul" className={styles.invitations}>
              {roster.invitations.map(invitation => (
                <li className={styles.invitation} key={`${invitation.email}·${invitation.expiresAt}`}>
                  <span className={styles.email}>{invitation.email}</span>
                  <Text as="span" size="xs" tone="tertiary">
                    {interpolate(t.invitationExpires, { date: shortDate(invitation.expiresAt) })}
                  </Text>
                </li>
              ))}
            </Card>
          </section>
        ) : null}

        {/* The practitioner's own pages: the profile and the badge (sheet «Clientes», last card). */}
        <div className={styles.side}>
          <Card as="ul" className={styles.rows}>
            <li className={styles.rowItem}>
              <Link className={styles.row} href="/consulta/perfil">
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t.profileTitle}</span>
                  {review ? <span className={styles.tag}>{review}</span> : null}
                </span>
                <span aria-hidden="true" className={styles.chevron} />
              </Link>
            </li>
            <li className={styles.rowItem}>
              <Link className={styles.row} href="/consulta/insignia">
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t.badgeTitle}</span>
                  {badgeLine ? (
                    <Text as="span" size="sm" tone="secondary">
                      {badgeLine}
                    </Text>
                  ) : null}
                </span>
                <span aria-hidden="true" className={styles.chevron} />
              </Link>
            </li>
          </Card>
        </div>
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
