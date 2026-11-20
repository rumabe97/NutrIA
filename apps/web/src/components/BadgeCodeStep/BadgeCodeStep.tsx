'use client';
import { useRef, useState } from 'react';

import styles from './BadgeCodeStep.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { AdminSelect } from 'components/AdminSelect';

import { BADGE_CHANNELS, issueBadgeCodeSchema } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';

import type { BadgeChannel } from 'core/entities/Professional';
import type { BadgeCodeIssuedView, BadgeRecordView } from 'core/controllers/Professional';
import type { IssuedCode } from 'components/BadgeIssuedCode';

interface BadgeCodeStepProps {
  /** The code is for a letter or a call: it is on screen once, held by the page. */
  onIssued: (issued: IssuedCode) => void;
  /** The code went by e-mail: said in words, whether the mail left or not. */
  onMailed: (answer: BadgeCodeIssuedView) => void;
  /** The API said there was nothing to send a code for any more. */
  onStale: () => void;
  record: BadgeRecordView;
}

type Field = 'email' | 'register' | 'registerName';

/**
 * Step 2 of the badge's check (sheet «ConsolaDistintivo»): the channel and, only by
 * e-mail, the three things the owner reads off the public register — the address, the
 * name and the college as it shows them. The API takes **no contact from the person
 * who applied**, and nothing here offers one to be typed from what they said; the page
 * says it in the words the sheet uses. By e-mail the code is mailed (it is not on
 * screen: nobody but its recipient reads it); by letter or phone it comes back in the
 * answer once, and the page above holds it (`BadgeIssuedCode`).
 *
 * The same schema the API validates the body with runs here first. The address, the
 * name and the college are used for the one mail and kept nowhere, and the form says so
 * beside them.
 */
export function BadgeCodeStep({ onIssued, onMailed, onStale, record }: BadgeCodeStepProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminBadge.step2;
  const [channel, setChannel] = useState<BadgeChannel>('register_email');
  const [values, setValues] = useState<Record<Field, string>>({ email: '', register: '', registerName: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const root = useRef<HTMLFormElement>(null);
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const word = (value: BadgeChannel) => dictionary.adminBadge.channelWords[value];
  const last = record.code;

  function set(field: Field, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  async function submit() {
    setError(undefined);

    const body =
      channel === 'register_email'
        ? { channel, email: values.email.trim(), register: values.register.trim(), registerName: values.registerName.trim() }
        : { channel };
    const parsed = issueBadgeCodeSchema.safeParse(body);

    if (!parsed.success) {
      const paths = new Set(parsed.error.issues.map(issue => issue.path[0]));

      setErrors({
        email: paths.has('email') ? t.emailError : undefined,
        register: paths.has('register') ? t.fieldError : undefined,
        registerName: paths.has('registerName') ? t.fieldError : undefined
      });
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

      return;
    }

    setErrors({});
    setPending(true);

    try {
      const answer = await api<BadgeCodeIssuedView>(`/admin/professionals/${encodeURIComponent(record.userId)}/badge/code`, {
        body: parsed.data,
        method: 'POST'
      });

      if (answer.code !== null && (answer.channel === 'post' || answer.channel === 'phone')) {
        onIssued({ channel: answer.channel, code: answer.code, expiresAt: answer.expiresAt, registerName: values.registerName.trim() });
      } else {
        onMailed(answer);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        onStale();
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  // Entered already: the next step is the owner's confirmation, not another code. The API would
  // issue one (it expires only codes not used), but it would be a code nobody needs, so it is not offered.
  if (last?.entered) {
    return (
      <Text size="sm" tone="secondary">
        {interpolate(t.codeEntered, { channel: word(last.channel) })}
      </Text>
    );
  }

  const lastLine = !last
    ? t.codeNone
    : last.entered
      ? interpolate(t.codeEntered, { channel: word(last.channel) })
      : last.live
        ? interpolate(t.codeOut, { channel: word(last.channel), date: day(last.expiresAt) })
        : interpolate(t.codeExpired, { channel: word(last.channel), date: day(last.expiresAt) });

  return (
    <form
      className={styles.form}
      noValidate={true}
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
      ref={root}
    >
      <Text size="sm" tone="secondary">
        {t.only}
      </Text>
      {record.state === 'due' ? <Text size="sm">{t.optional}</Text> : null}

      <AdminSelect
        label={t.channel}
        onChange={event => {
          setChannel(event.currentTarget.value as BadgeChannel);
          setErrors({});
        }}
        options={BADGE_CHANNELS.map(option => ({ label: t.channels[option], value: option }))}
        value={channel}
      />

      {channel === 'register_email' ? (
        <div className={styles.fields}>
          <Input
            autoComplete="off"
            error={errors.email}
            hint={t.emailHint}
            inputMode="email"
            label={t.email}
            onChange={event => set('email', event.currentTarget.value)}
            spellCheck={false}
            type="email"
            value={values.email}
          />
          <Input
            autoComplete="off"
            error={errors.registerName}
            hint={t.registerNameHint}
            label={t.registerName}
            lang="es"
            onChange={event => set('registerName', event.currentTarget.value)}
            value={values.registerName}
          />
          <Input
            autoComplete="off"
            error={errors.register}
            hint={t.registerNameHint}
            label={t.register}
            lang="es"
            onChange={event => set('register', event.currentTarget.value)}
            value={values.register}
          />
        </div>
      ) : (
        <Input
          autoComplete="off"
          hint={t.registerNameLocalHint}
          label={t.registerNameLocal}
          lang="es"
          onChange={event => set('registerName', event.currentTarget.value)}
          value={values.registerName}
        />
      )}

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      <div className="button-row">
        <Button aria-disabled={pending || undefined} loading={pending} type="submit" variant="secondary">
          {t.send[channel]}
        </Button>
      </div>

      <Text size="sm" tone="secondary">
        {lastLine}
      </Text>
      {/* A code for a letter or a call is on screen once: after a reload it cannot be seen again. */}
      {last?.live && last.channel !== 'register_email' ? (
        <Text size="sm" tone="secondary">
          {t.codeGone}
        </Text>
      ) : null}
    </form>
  );
}
