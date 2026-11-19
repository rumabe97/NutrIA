'use client';
import { useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareReconsent.module.css';

import { Button } from 'ui/components/Button';
import { Checkbox } from 'ui/components/Checkbox';
import { Link } from 'ui/components/Link';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';

import { api, messageFor } from 'lib/api';
import { practicePrivacyHref } from 'lib/practicePrivacy';
import { withProfessional } from 'lib/professionalName';

import type { CareLinkView } from 'core/controllers/Care';

interface CareReconsentProps {
  /** The practitioner's name as it may be shown, or null for «tu profesional». */
  professionalName: string | null;
}

/** What the badged list adds to a plan-only link (`textos/05` § F.4: B1's list without the name, which it already has). */
const WIDER = ['targets', 'mealPlans', 'progress', 'checkIns'] as const;

/** The one placeholder `care.invitationPrivacy` carries besides `{professional}`. */
const PRIVACY_PLACEHOLDER = '{privacy}';

/**
 * The badge arrived with the link already open (`docs/legal/textos/05` § F.4,
 * `0111` § 4): the practitioner keeps seeing only the plans until the client
 * says yes to the badged list. Shown on the client's link card only while
 * `reconsentOffered` — a plan-only link whose practitioner's badge stands now.
 *
 * «Sí, compartir esto también» widens the link at today's
 * `CARE_CONSENT_VERSION` (`POST /care/links/me/consent`); the health line stays
 * apart and unticked, as in B2, and is turned on only if ticked, by its own
 * request once the link is wide. «Ahora no» folds the offer for this visit;
 * it comes back here, as its hint says, while the badge stands.
 */
export function CareReconsent({ professionalName }: CareReconsentProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.care;
  const [health, setHealth] = useState(false);
  const [pending, setPending] = useState(false);
  const [later, setLater] = useState(false);
  const [error, setError] = useState<string>();
  const healthNoteId = useId();
  const laterRef = useRef<HTMLParagraphElement>(null);
  const named = (template: string) => withProfessional(template, professionalName, t.professionalUnnamed);

  useEffect(() => {
    if (later) {
      laterRef.current?.focus();
    }
  }, [later]);

  async function accept() {
    setError(undefined);
    setPending(true);

    try {
      await api<CareLinkView>('/care/links/me/consent', { body: { consentVersion: CARE_CONSENT_VERSION }, method: 'POST' });

      if (health) {
        await api<CareLinkView>('/care/links/me', { body: { sharesHealth: true }, method: 'PATCH' });
      }

      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
      setPending(false);
    }
  }

  if (later) {
    return (
      <Text className={styles.later} ref={laterRef} size="sm" tabIndex={-1} tone="secondary">
        {t.reconsentLaterHint}
      </Text>
    );
  }

  return (
    <section aria-labelledby="reconsent-title" className={styles.offer}>
      <h4 className={styles.title} id="reconsent-title">
        {named(t.reconsentTitle)}
      </h4>
      <Text size="sm">{t.reconsentBody}</Text>
      <ul className={styles.list}>
        {WIDER.map(share => (
          <li key={share}>{t.shares[share]}</li>
        ))}
        <li>{t.canDo.targets}</li>
      </ul>

      <div className={styles.health}>
        <Checkbox aria-describedby={healthNoteId} checked={health} label={t.healthQuestion} onCheckedChange={value => setHealth(value === true)} />
        <Text id={healthNoteId} size="xs" tone="tertiary">
          {t.healthShareNote}
        </Text>
      </div>

      <Text size="sm" tone="secondary">
        {t.inferenceAllergy}
      </Text>
      <Text size="sm" tone="secondary">
        {t.inferenceBadgeLoss}
      </Text>
      <Text size="xs" tone="tertiary">
        {named(t.invitationPrivacy)
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

      <div className={`${styles.actions} button-row`}>
        <Button loading={pending} onClick={() => void accept()} type="button">
          {t.reconsentAccept}
        </Button>
        <Button disabled={pending} onClick={() => setLater(true)} type="button" variant="secondary">
          {t.reconsentLater}
        </Button>
      </div>
    </section>
  );
}
