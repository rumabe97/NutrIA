'use client';
import { useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareInvitation.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Link } from 'ui/components/Link';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';
import { withLocale } from 'i18n/routes';

import { Card } from 'components/Card';
import { CtaLink } from 'components/CtaLink';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';

import type { CareInvitationDetailView, CareLinkView } from 'core/controllers/Care';

interface CareInvitationProps {
  invitation: CareInvitationDetailView;
  token: string;
}

/** What every professional can do under a link, whatever it shares (textos/05 § B1) — fixed, not part of the invitation's own answer. */
const CAN_DO = ['targets', 'plans', 'review'] as const;

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
  const healthNoteId = useId();
  const existingHeadingRef = useRef<HTMLHeadingElement>(null);

  // The `existing` branch below swaps the whole card in place with no route
  // change, so `RouteAnnouncer` never fires — move focus to its new `<h1>`
  // ourselves, or nothing tells a keyboard/screen-reader user the page changed.
  useEffect(() => {
    if (existing) {
      existingHeadingRef.current?.focus();
    }
  }, [existing]);

  async function accept() {
    setError(undefined);
    setPending('accept');

    try {
      await api<CareLinkView>(`/care/invitations/${token}/accept`, {
        body: { consentVersion: invitation.consentVersion, sharesHealth },
        method: 'POST'
      });
      router.push('/perfil');
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'CARE_LINK_EXISTS' && caught.link) {
        setExisting(caught.link);
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

  if (existing) {
    return (
      <Card as="section" className={styles.card} padding="lg">
        <h1 className={styles.title} ref={existingHeadingRef} tabIndex={-1}>
          {t.invitationLinkExistsTitle}
        </h1>
        <Text tone="secondary">
          {interpolate(t.invitationLinkExistsBody, {
            professional: existing.professionalName,
            since: formatInstant(Date.parse(existing.since), locale, { day: 'numeric', month: 'long', year: 'numeric' })
          })}
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
    <Card as="section" className={styles.card} padding="lg">
      <h1 className={styles.title}>{interpolate(t.invitationTitle, { professional: invitation.professionalName })}</h1>
      <Text tone="secondary">
        {interpolate(t.invitationIntro, { collegiateNumber: invitation.collegiateNumber, professional: invitation.professionalName })}
      </Text>

      <div className={styles.block}>
        <Text weight="medium">{interpolate(t.invitationShareIntro, { professional: invitation.professionalName })}</Text>
        <ul className={styles.list}>
          {invitation.shares.map(share => (
            <li key={share}>{t.shares[share]}</li>
          ))}
        </ul>
        <Text weight="medium">{t.invitationCanDoIntro}</Text>
        <ul className={styles.list}>
          {CAN_DO.map(item => (
            <li key={item}>{t.canDo[item]}</li>
          ))}
        </ul>
        <Text size="sm" tone="secondary">
          {t.invitationNotShared}
        </Text>
        <Text size="sm" tone="secondary">
          {t.invitationTrail}
        </Text>
      </div>

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
          <div className={styles.block}>
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

      <Text size="xs" tone="tertiary">
        {interpolate(t.invitationPrivacy, { professional: invitation.professionalName })
          .split(/(\{privacy\})/)
          .map(part =>
            part === PRIVACY_PLACEHOLDER ? (
              <Link href={withLocale('/privacidad#tu-dietista', locale)} inline={true} key={part}>
                {dictionary.auth.legalPrivacy}
              </Link>
            ) : (
              part
            )
          )}
      </Text>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button disabled={pending === 'decline'} loading={pending === 'accept'} onClick={() => void accept()} size="lg" type="button">
          {t.invitationAccept}
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
