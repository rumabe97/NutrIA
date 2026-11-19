'use client';
import { Fragment, useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareInvitation.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { LEGAL_IDENTITY } from 'i18n/legalIdentity';
import { Link } from 'ui/components/Link';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';
import { MailtoText } from 'components/MailtoText';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';
import { practicePrivacyHref } from 'lib/practicePrivacy';

import type { CareInvitationDetailView, CareLinkView } from 'core/controllers/Care';

interface CareInvitationProps {
  invitation: CareInvitationDetailView;
  token: string;
}

/** What a badged professional can do under a link (textos/05 § B1) — fixed, not part of the invitation's own answer. */
const CAN_DO = ['targets', 'plans', 'review'] as const;

/** Without the badge, no targets (textos/05 § F.3: `care.canDo.plans`, `care.canDo.review`, not `targets`). */
const CAN_DO_PLAN = ['plans', 'review'] as const;

/** The one placeholder `care.invitationPrivacy` carries besides `{professional}`, and the page it opens. */
const PRIVACY_PLACEHOLDER = '{privacy}';

/**
 * What the invitation reads before answering (PRD 004, criterion 3): who
 * invites, the consent list, the separate health line, one primary action to
 * accept, a secondary to decline. Nothing is shared until *Aceptar* is
 * pressed — declining, or never answering, shares nothing.
 */
export function CareInvitation({ invitation, token }: CareInvitationProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.care;
  const [sharesHealth, setSharesHealth] = useState(false);
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string>();
  const [existing, setExisting] = useState<ApiError['link']>(null);
  // Refused under the illness rule (`0111` § 8): the invitation stays open, and § G.2 says why.
  const [refused, setRefused] = useState(false);
  const healthNoteId = useId();
  const existingHeadingRef = useRef<HTMLHeadingElement>(null);
  // Without the badge the invitation carries the plan-only list, no number and no health line
  // (`0111` § 4), in the words of `textos/05` § F.3, with its fixed notice and «Acepto y
  // consiento» on the button (C4). With it, § F.1–F.2: the badge line, the badged list, the
  // health line apart, and what a refused dish or a lost badge lets the practitioner work out.
  const planOnly = invitation.scope === 'plan';
  const professional = invitation.professionalName;
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const offersHealth = invitation.healthShares.length > 0;

  // The `existing` branch below swaps the whole card in place with no route
  // change, so `RouteAnnouncer` never fires — move focus to its new `<h1>`
  // ourselves, or nothing tells a keyboard/screen-reader user the page changed.
  useEffect(() => {
    if (existing || refused) {
      existingHeadingRef.current?.focus();
    }
  }, [existing, refused]);

  async function accept() {
    setError(undefined);
    setPending('accept');

    try {
      await api<CareLinkView>(`/care/invitations/${token}/accept`, {
        // `consentScope` names the list this page showed, so a badge that changes in between can
        // only narrow what is recorded (`acceptInvitationSchema`).
        body: { consentScope: invitation.scope, consentVersion: invitation.consentVersion, sharesHealth: offersHealth && sharesHealth },
        method: 'POST'
      });
      router.push('/perfil');
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'CARE_LINK_EXISTS' && caught.link) {
        setExisting(caught.link);
      } else if (caught instanceof ApiError && caught.code === 'CARE_ILLNESS_RULE') {
        setRefused(true);
      } else {
        setError(messageFor(caught, dictionary));
      }

      setPending(null);
    }
  }

  async function decline() {
    setError(undefined);
    setPending('decline');

    try {
      await api(`/care/invitations/${token}/decline`, { method: 'POST' });
      router.push('/inicio');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(null);
    }
  }

  // No way forward but the app's own navigation: § G.1's note — nothing here may suggest that
  // removing what is on record would let the invitation through.
  if (refused) {
    return (
      <Card as="section" className={`${styles.card} motion-list`} padding="lg">
        <h1 className={styles.title} ref={existingHeadingRef} tabIndex={-1}>
          {t.illnessRefusedTitle}
        </h1>
        <Text tone="secondary">
          <MailtoText email={LEGAL_IDENTITY.email} text={interpolate(t.illnessRefusedBody, { professional: invitation.professionalName })} />
        </Text>
      </Card>
    );
  }

  if (existing) {
    const existingSince = formatInstant(Date.parse(existing.since), locale, { day: 'numeric', month: 'long', year: 'numeric' });

    return (
      <Card as="section" className={`${styles.card} motion-list`} padding="lg">
        <h1 className={styles.title} ref={existingHeadingRef} tabIndex={-1}>
          {t.invitationLinkExistsTitle}
        </h1>
        <Text tone="secondary">
          {/* A name that may not be shown comes as null (PRD 025): legal's own sentence, never a blank. */}
          {existing.professionalName
            ? interpolate(t.invitationLinkExistsBody, { professional: existing.professionalName, since: existingSince })
            : interpolate(t.invitationLinkExistsBodyNoName, { since: existingSince })}
        </Text>
        <div className={styles.actions}>
          <CtaLink href="/perfil" size="lg">
            {t.invitationLinkExistsCta}
          </CtaLink>
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" className={`${styles.card} motion-list`} padding="lg">
      <div className={styles.who}>
        <h1 className={styles.title}>{interpolate(t.invitationTitle, { professional })}</h1>
        <Text tone="secondary">{interpolate(planOnly ? t.invitationIntroPlan : t.invitationIntro, { professional })}</Text>
        {/* The title only from the owner's `pass` check, never from text; without it, the fixed notice. */}
        {planOnly ? (
          <span className={styles.notice}>{t.invitationNotice}</span>
        ) : invitation.badge?.collegiateNumber ? (
          <span className={styles.badge}>
            {interpolate(t.invitationBadge, { checkedOn: day(invitation.badge.checkedAt), collegiateNumber: invitation.badge.collegiateNumber })}
          </span>
        ) : null}
      </div>

      <div className={styles.block}>
        <Text weight="medium">{interpolate(planOnly ? t.invitationShareIntroPlan : t.invitationShareIntro, { professional })}</Text>
        <ul className={styles.list}>
          {planOnly
            ? invitation.sharesPlan.map(share => <li key={share}>{t.sharesPlan[share]}</li>)
            : invitation.shares.map(share => <li key={share}>{t.shares[share]}</li>)}
        </ul>
        <Text weight="medium">{t.invitationCanDoIntro}</Text>
        <ul className={styles.list}>
          {(planOnly ? CAN_DO_PLAN : CAN_DO).map(item => (
            <li key={item}>{t.canDo[item]}</li>
          ))}
        </ul>
        <Text size="sm" tone="secondary">
          {planOnly ? t.invitationNotSharedPlan : t.invitationNotShared}
        </Text>
        {planOnly ? (
          <Fragment>
            <Text size="sm" tone="secondary">
              {t.inferencePlan}
            </Text>
            <Text size="sm" tone="secondary">
              {interpolate(t.illnessRulePlan, { professional })}
            </Text>
          </Fragment>
        ) : (
          <Fragment>
            <Text size="sm" tone="secondary">
              {t.inferenceAllergy}
            </Text>
            <Text size="sm" tone="secondary">
              {t.inferenceBadgeLoss}
            </Text>
          </Fragment>
        )}
        <Text size="sm" tone="secondary">
          {t.invitationTrail}
        </Text>
      </div>

      {offersHealth ? (
        <div className={styles.block}>
          <Checkbox
            aria-describedby={healthNoteId}
            checked={sharesHealth}
            label={t.healthQuestion}
            onCheckedChange={value => setSharesHealth(value === true)}
          />
          <Text className={styles.hint} id={healthNoteId} size="sm" tone="tertiary">
            {t.healthShareNote}
          </Text>

          {sharesHealth ? (
            <div className={`${styles.extra} motion-drop-in`}>
              <Text size="sm" tone="secondary">
                {t.healthShareIntro}
              </Text>
              <ul className={styles.list}>
                {invitation.healthShares.map(share => (
                  <li key={share}>{t.healthShares[share]}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Text size="xs" tone="tertiary">
        {interpolate(planOnly ? t.invitationPrivacyPlan : t.invitationPrivacy, { professional })
          .split(/(\{privacy\})/)
          .map(part =>
            part === PRIVACY_PLACEHOLDER ? (
              <Link href={practicePrivacyHref(locale)} inline={true} key={part}>
                {dictionary.auth.legalPrivacy}
              </Link>
            ) : (
              part
            )
          )}
      </Text>

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      <div className={styles.actions}>
        <Button disabled={pending === 'decline'} loading={pending === 'accept'} onClick={() => void accept()} size="lg" type="button">
          {planOnly ? t.invitationAcceptPlan : t.invitationAccept}
        </Button>
        <Button
          disabled={pending === 'accept'}
          loading={pending === 'decline'}
          onClick={() => void decline()}
          size="lg"
          type="button"
          variant="secondary"
        >
          {t.declineCta}
        </Button>
      </div>
    </Card>
  );
}
