'use client';
import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PracticeBadge.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Link } from 'ui/components/Link';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';

import { api, ApiError, messageFor } from 'lib/api';
import { badgeReason, badgeSentence, badgeStands } from 'lib/badgeState';
import { formatInstant, interpolate } from 'lib/format';
import { practicePrivacyHref } from 'lib/practicePrivacy';

import type { BadgeView } from 'core/controllers/Professional';

interface PracticeBadgeProps {
  badge: BadgeView;
}

/** Where each state stands on the way to the badge: the application, the code, the badge. */
const STEP_OF: Record<BadgeView['state'], number> = { applied: 0, badged: 3, code_sent: 1, due: 3, lapsed: 0, none: 0, refused: 0, withdrawn: 0 };

/** The one placeholder `practice.badgeApplyPrivacy` carries, and where it points. */
const PRIVACY_PLACEHOLDER = '{privacy}';

/**
 * The practitioner's badge (PRD 025 scope 6, `0111` §§ 2–3; sheet
 * «Distintivo»), in the approved words of `docs/legal/textos/01` § Pantallas P2
 * and P3: the application — a register and a number, never a contact, with
 * the art. 13 sentence on screen before the first `POST` — then the code the
 * owner sends through the register's own contact, then the badge.
 *
 * Every state the API gives has its sentence: none, applied, a code sent (and
 * entered), badged, due, lapsed, refused, withdrawn — the last three with the
 * reason, in the words of their statement (`lib/badgeState`). The title and the
 * number are drawn only from a standing badge (PRD 025 criterion 5). A wrong,
 * used or expired code is one sentence, as the route answers them all alike.
 */
export function PracticeBadge({ badge }: PracticeBadgeProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.practice;
  const [pending, setPending] = useState<'apply' | 'code'>();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'code' | 'number' | 'register', string>>>({});
  const [moved, setMoved] = useState(false);
  const statusRef = useRef<HTMLHeadingElement>(null);
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const stands = badgeStands(badge);
  const step = badge.state === 'code_sent' && badge.codeEntered ? 2 : STEP_OF[badge.state];
  const canApply = badge.state === 'none' || badge.state === 'lapsed' || badge.state === 'refused' || badge.state === 'withdrawn';
  const askCode = badge.state === 'code_sent' && !badge.codeEntered;
  const reason = badgeReason(badge, t, day);

  // After an application or a code the page is read again in place: the status says what changed.
  useEffect(() => {
    if (moved) {
      statusRef.current?.focus();
    }
  }, [badge.state, badge.codeEntered, moved]);

  async function apply(form: FormData) {
    setError(undefined);
    setFieldErrors({});
    setPending('apply');

    try {
      await api('/care/practice/badge', {
        body: { number: String(form.get('number') ?? '').trim(), register: String(form.get('register') ?? '').trim() },
        method: 'POST'
      });
      setMoved(true);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_INPUT') {
        setFieldErrors({
          number: caught.fieldErrors.number ? dictionary.errors.invalidInput : undefined,
          register: caught.fieldErrors.register ? dictionary.errors.invalidInput : undefined
        });
      }

      setError(messageFor(caught, dictionary));
    } finally {
      setPending(undefined);
    }
  }

  async function enter(code: string) {
    setError(undefined);
    setFieldErrors({});
    setPending('code');

    try {
      await api('/care/practice/badge/code', { body: { code }, method: 'POST' });
      setMoved(true);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        setFieldErrors({ code: t.badgeCodeWrong });
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(undefined);
    }
  }

  const errorNote = error ? (
    <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
      {error}
    </Note>
  ) : null;

  return (
    <div className={styles.root}>
      {stands ? (
        <Card aria-labelledby="badge-status" as="section" className={styles.card}>
          <h2 className={styles.cardTitle} id="badge-status" ref={statusRef} tabIndex={-1}>
            {interpolate(t.badgeState.badged, { date: badge.checkedAt ? day(badge.checkedAt) : '' })}
          </h2>
          {badge.state === 'due' ? <Text size="sm">{badgeSentence(badge, t, day)}</Text> : null}
          {badge.checkedAt && badge.register && badge.number ? (
            <Text size="sm" tone="secondary">
              {interpolate(t.badgeMeaning, { date: day(badge.checkedAt), number: badge.number, register: badge.register })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {!stands && !canApply ? (
        <Card aria-labelledby="badge-status" as="section" className={styles.card}>
          <ol className={styles.steps}>
            {[t.badgeSteps.apply, t.badgeSteps.code, t.badgeSteps.badge].map((label, index) => (
              <li
                aria-current={index === step ? 'step' : undefined}
                className={styles.step}
                data-state={index < step ? 'done' : index === step ? 'now' : 'next'}
                key={label}
              >
                <span aria-hidden="true" className={styles.marker}>
                  {index + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <h2 className={styles.status} id="badge-status" ref={statusRef} tabIndex={-1}>
            {badgeSentence(badge, t, day)}
          </h2>

          {askCode ? (
            <form
              className={styles.form}
              noValidate={true}
              onSubmit={event => {
                event.preventDefault();
                void enter(String(new FormData(event.currentTarget).get('code') ?? '').trim());
              }}
            >
              <Input
                autoComplete="one-time-code"
                className={styles.code}
                error={fieldErrors.code}
                label={t.badgeCode}
                name="code"
                required={true}
                spellCheck={false}
              />
              {errorNote}
              <div className={styles.actions}>
                <Button loading={pending === 'code'} type="submit">
                  {t.badgeCodeCta}
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      ) : null}

      {canApply ? (
        <Card aria-labelledby="badge-apply" as="section" className={styles.card}>
          {badge.state === 'none' ? null : (
            <Note as="div" tone="info" toneLabel={dictionary.common.noteTone.info}>
              <Text size="sm" weight="medium">
                {badgeSentence(badge, t, day)}
              </Text>
              {reason ? <Text size="sm">{reason}</Text> : null}
            </Note>
          )}

          <h2 className={styles.cardTitle} id="badge-apply" ref={statusRef} tabIndex={-1}>
            {t.badgeApplyTitle}
          </h2>
          <form
            className={styles.form}
            noValidate={true}
            onSubmit={event => {
              event.preventDefault();
              void apply(new FormData(event.currentTarget));
            }}
          >
            <Input autoComplete="organization" error={fieldErrors.register} label={t.badgeRegister} name="register" required={true} />
            <Input autoComplete="off" error={fieldErrors.number} label={t.badgeNumber} name="number" required={true} spellCheck={false} />
            {/* Art. 13, before the first application leaves the page (`textos/01` § P2). */}
            <Text size="xs" tone="secondary">
              {t.badgeApplyPrivacy.split(/(\{privacy\})/).map(part =>
                part === PRIVACY_PLACEHOLDER ? (
                  <Link href={practicePrivacyHref(locale)} inline={true} key={part}>
                    {dictionary.auth.legalPrivacy}
                  </Link>
                ) : (
                  part
                )
              )}
            </Text>
            {errorNote}
            <div className={styles.actions}>
              <Button loading={pending === 'apply'} type="submit">
                {t.badgeApplyCta}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
