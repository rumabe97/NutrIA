'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareInviteForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Link } from 'ui/components/Link';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, formatNumber, interpolate } from 'lib/format';

import type { CareInvitationView } from 'core/controllers/Care';

interface CareInviteFormProps {
  /** Whether a practice plan is paid for (`CarePracticeView.open`): only then is there a portal to choose a larger one on. */
  paid: boolean;
  /** The practice's limit (`CarePracticeView.seats`): the number a full practice is said to hold. */
  seats: number;
}

type Outcome =
  { email: string; expiresAt: string; kind: 'sent' } | { kind: 'failed'; message: string } | { kind: 'full' } | { kind: 'name'; sentence: string };

/**
 * Why the account's name stops an invitation (`textos/01` § P5): by the list the API names
 * — a word only the badge allows, or a title nobody may claim — with the word, or the plain
 * sentence when the API gives none. Names are judged for titles only, never for results.
 */
function nameRefusal(code: string | undefined, sentences: { badgeOnly: string; never: string; plain: string }): string {
  const colon = code ? code.indexOf(':') : -1;
  const list = code && colon > 0 ? code.slice(0, colon) : '';
  const word = code && colon > 0 ? code.slice(colon + 1) : '';

  if (word && list === 'badge_only') {
    return interpolate(sentences.badgeOnly, { word });
  }

  if (word && list === 'never') {
    return interpolate(sentences.never, { word });
  }

  return sentences.plain;
}

/**
 * An address, and nothing else: who the professional invites (`0059`). The
 * answer is the same whether or not the address has an account, so the screen
 * says the same thing either way.
 *
 * A full practice (`PRACTICE_FULL`, PRD 004 criterion 17) is not an error to
 * apologise for but a state with its ways out, in the approved sentence (legal
 * § 7): end a link, or wait for an invitation to expire. A paid practice may also
 * move to a larger plan on Stripe's portal; a free one has nothing to buy.
 *
 * An account name carrying a word a practice may not show (PRD 025, a 422 on
 * `name`) is the practitioner's to change, not the address's: the word in its
 * approved sentence, and a link to where the name is changed.
 */
export function CareInviteForm({ paid, seats }: CareInviteFormProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.practice;
  const form = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState<'invite' | 'portal'>();
  const [fieldError, setFieldError] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>();

  async function invite(email: string) {
    setPending('invite');
    setFieldError(undefined);
    setOutcome(undefined);

    try {
      const sent = await api<CareInvitationView>('/care/invitations', { body: { email }, method: 'POST' });

      setOutcome({ ...sent, kind: 'sent' });
      form.current?.reset();
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'PRACTICE_FULL') {
        setOutcome({ kind: 'full' });
      } else if (caught instanceof ApiError && caught.code === 'INVALID_INPUT' && caught.fieldErrors.name) {
        // The practitioner's own account name carries a word a practice may not show (PRD 025):
        // the address is not blamed. The word in its approved sentence, and the way to change it.
        setOutcome({ kind: 'name', sentence: nameRefusal(caught.fieldErrors.name[0], t.inviteNameRefused) });
      } else if (caught instanceof ApiError && caught.code === 'INVALID_INPUT') {
        setFieldError(t.inviteInvalid);
      } else {
        setOutcome({ kind: 'failed', message: messageFor(caught, dictionary) });
      }
    } finally {
      setPending(undefined);
    }
  }

  async function portal() {
    setPending('portal');

    try {
      const { url } = await api<{ url: string }>('/billing/portal', { method: 'POST' });

      window.location.assign(url);
    } catch (caught) {
      setOutcome({ kind: 'failed', message: messageFor(caught, dictionary) });
      setPending(undefined);
    }
  }

  return (
    <Card aria-labelledby="invite-title" as="section" className={styles.card}>
      <h2 className={styles.title} id="invite-title">
        {t.inviteTitle}
      </h2>

      <form
        className={styles.form}
        noValidate={true}
        onSubmit={event => {
          event.preventDefault();
          void invite(String(new FormData(event.currentTarget).get('email') ?? ''));
        }}
        ref={form}
      >
        <Input autoComplete="off" error={fieldError} hint={t.inviteHint} label={t.inviteEmail} name="email" required={true} type="email" />
        <div className={styles.actions}>
          <Button disabled={pending === 'portal'} loading={pending === 'invite'} type="submit">
            {pending === 'invite' ? t.invitePending : t.inviteCta}
          </Button>
        </div>
      </form>

      {/* Inserted rather than edited in place, so the region is announced when it appears. */}
      {outcome?.kind === 'sent' ? (
        <Note as="p" className="motion-drop-in" role="status" tone="success" toneLabel={dictionary.common.noteTone.success}>
          {interpolate(t.inviteSent, {
            date: formatInstant(Date.parse(outcome.expiresAt), locale, { day: 'numeric', month: 'long' }),
            email: outcome.email
          })}
        </Note>
      ) : null}

      {outcome?.kind === 'full' ? (
        <Note className={`${styles.full} motion-drop-in`} role="alert" tone="warning" toneLabel={dictionary.common.noteTone.warning}>
          <Text size="sm" weight="medium">
            {interpolate(t.inviteFull, { count: formatNumber(seats, locale) })}
          </Text>
          {paid ? (
            <div className={styles.actions}>
              <Button disabled={pending === 'invite'} loading={pending === 'portal'} onClick={() => void portal()} type="button" variant="secondary">
                {t.inviteFullUp}
              </Button>
            </div>
          ) : null}
        </Note>
      ) : null}

      {outcome?.kind === 'name' ? (
        <Note className="motion-drop-in" role="alert" tone="warning" toneLabel={dictionary.common.noteTone.warning}>
          <Text size="sm" weight="medium">
            {outcome.sentence}
          </Text>
          <Text size="sm">
            <Link className={styles.rename} href="/consulta/perfil#nombre" inline={true}>
              {t.nameCta}
            </Link>
          </Text>
        </Note>
      ) : null}

      {outcome?.kind === 'failed' ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {outcome.message}
        </Note>
      ) : null}
    </Card>
  );
}
