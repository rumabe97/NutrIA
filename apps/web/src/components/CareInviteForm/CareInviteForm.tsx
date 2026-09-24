'use client';
import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './CareInviteForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, formatNumber, interpolate } from 'lib/format';

import type { CareInvitationView } from 'core/controllers/Care';

type Outcome = { email: string; expiresAt: string; kind: 'sent' } | { included: number; kind: 'full' } | { kind: 'failed'; message: string };

/**
 * An address, and nothing else: who the professional invites (`0059`). The
 * answer is the same whether or not the address has an account, so the screen
 * says the same thing either way.
 *
 * A full practice (`PRACTICE_FULL`, PRD 004 criterion 17) is not an error to
 * apologise for but a state with two ways out, and both are named: the larger
 * plan, chosen on Stripe's portal, or ending a link with somebody no longer seen.
 */
export function CareInviteForm() {
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
        setOutcome({ included: caught.practice?.includedClients ?? 0, kind: 'full' });
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
        <p className={styles.sent} role="status">
          {interpolate(t.inviteSent, {
            date: formatInstant(Date.parse(outcome.expiresAt), locale, { day: 'numeric', month: 'long' }),
            email: outcome.email
          })}
        </p>
      ) : null}

      {outcome?.kind === 'full' ? (
        <div className={styles.full} role="alert">
          <Text size="sm" weight="medium">
            {interpolate(t.inviteFull, { count: formatNumber(outcome.included, locale) })}
          </Text>
          <Text size="sm" tone="secondary">
            {t.inviteFullEnd}
          </Text>
          <div className={styles.actions}>
            <Button disabled={pending === 'invite'} loading={pending === 'portal'} onClick={() => void portal()} type="button" variant="secondary">
              {t.inviteFullUp}
            </Button>
          </div>
        </div>
      ) : null}

      {outcome?.kind === 'failed' ? (
        <p className={styles.error} role="alert">
          {outcome.message}
        </p>
      ) : null}
    </Card>
  );
}
