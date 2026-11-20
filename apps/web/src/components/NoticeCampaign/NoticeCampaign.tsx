'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import styles from './NoticeCampaign.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Note } from 'ui/components/Note';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { BadgeStep } from 'components/BadgeStep';
import { NoticeMail } from 'components/NoticeMail';
import { NoticeRecipients } from 'components/NoticeRecipients';

import { ACCOUNT_NOTICES, NOTICE_BATCH_SIZE, NOTICE_MAX_DAYS_AHEAD } from 'core/entities/Notice';

import { addDays, madridDay } from 'lib/madridDay';
import { api, ApiError, messageFor } from 'lib/api';
import { formatDate, formatInstant, formatNumber, interpolate } from 'lib/format';

import type { NoticeMailWords } from 'components/NoticeMail';
import type { NoticePreviewView, NoticeSendView } from 'core/controllers/Notice';
import type { ReactNode } from 'react';

/** The one notice this page sends: core's closed list, so the route can never name another. */
const NOTICE = ACCOUNT_NOTICES[0];

/** Rows on one page of the recipients' list. */
const PAGE_SIZE = 25;

type Locale2 = 'en-GB' | 'es-ES';

interface NoticeCampaignProps {
  /** The address the service answers at, as the mail fills `{email}`. */
  email: string;
  /** Each language's privacy policy (at «Tu profesional en NutrIA») and terms, whole, as the mail fills them. */
  links: Record<Locale2, { privacyUrl: string; termsUrl: string }>;
  /** The mail's approved words in each language (`textos/06` § Z). */
  mail: Record<Locale2, NoticeMailWords>;
}

/** Where the campaign stands: not started, owed to some, told to all, or past the day it announced. */
type Standing = { readonly date: null; readonly state: 'none' } | { readonly date: string; readonly state: 'finished' | 'open' | 'past' };

type Result = { readonly body: ReactNode; readonly tone: 'error' | 'success' | 'warning' };

/** The 422's code for the day, if that is what was refused: `not_after_today`, `too_far`, or the day a campaign already uses. */
function dateRefusal(error: unknown): { campaignDate: string } | { code: 'not_after_today' | 'too_far' } | null {
  if (!(error instanceof ApiError) || error.code !== 'INVALID_INPUT') {
    return null;
  }

  const code = error.fieldErrors.date?.[0] ?? '';

  if (code.startsWith('campaign_date:')) {
    return { campaignDate: code.slice('campaign_date:'.length) };
  }

  return code === 'not_after_today' || code === 'too_far' ? { code } : null;
}

/**
 * The change notice, sent from the console (project 025 phase 10; `docs/legal/textos/06`
 * § Z): one flow the owner cannot get wrong, in four numbered steps.
 *
 * 1. The mail itself in both languages, the day written in once there is one (what it is, the
 *    page's header says).
 * 2. The day of the change — the day he will throw the `professional` switch: free until a
 *    campaign starts, then locked to that campaign's day; the API's three refusals said on
 *    the field.
 * 3. «Ver a quién»: the counts and the paged list. Nothing is sent.
 * 4. «Enviar a los siguientes N»: only after a preview of the same day, and only through a
 *    second, explicit step that states the consequence. One press at a time (`aria-disabled`
 *    while it runs); what happened is said where focus goes, and the next batch is offered
 *    while some are owed.
 *
 * On arrival it asks the API, with tomorrow's day, whether a campaign has started: that
 * read sends nothing and is not the owner's preview. No address leaves this component —
 * not into the URL, storage, the clipboard or a log.
 */
export function NoticeCampaign({ email, links, mail }: NoticeCampaignProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminNotice;
  const [standing, setStanding] = useState<Standing | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [date, setDate] = useState('');
  const [dateError, setDateError] = useState<string>();
  const [preview, setPreview] = useState<{ date: string; view: NoticePreviewView } | null>(null);
  const [previewError, setPreviewError] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [after, setAfter] = useState<string | undefined>();
  const [result, setResult] = useState<Result | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const counts = useRef<HTMLDivElement>(null);
  const confirmTitle = useRef<HTMLHeadingElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const number = (value: number) => formatNumber(value, locale);
  const day = (iso: string) => formatDate(iso, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const today = madridDay(new Date());
  const tomorrow = addDays(today, 1);

  const previewFor = useCallback(
    (on: string, offset: number) =>
      api<NoticePreviewView>(`/admin/notices/${NOTICE}/preview?offset=${String(offset)}&size=${String(PAGE_SIZE)}`, {
        body: { date: on },
        method: 'POST'
      }),
    []
  );

  const standingOf = (on: string, view: NoticePreviewView): Standing => ({ date: on, state: view.toSend === 0 ? 'finished' : 'open' });

  /** Whether a campaign has started, and for which day — read once on arrival, sending nothing. */
  const load = useCallback(async () => {
    setLoadFailed(false);

    try {
      const view = await previewFor(addDays(madridDay(new Date()), 1), 0);

      if (view.campaignDate === null) {
        setStanding({ date: null, state: 'none' });
      } else {
        setStanding(standingOf(view.campaignDate, view));
        setDate(view.campaignDate);
      }
    } catch (caught) {
      const refusal = dateRefusal(caught);

      if (refusal && 'campaignDate' in refusal) {
        setDate(refusal.campaignDate);

        try {
          setStanding(standingOf(refusal.campaignDate, await previewFor(refusal.campaignDate, 0)));
        } catch (again) {
          const late = dateRefusal(again);

          if (late && 'code' in late && late.code === 'not_after_today') {
            setStanding({ date: refusal.campaignDate, state: 'past' });
          } else {
            setLoadFailed(true);
          }
        }
      } else {
        setLoadFailed(true);
      }
    }
  }, [previewFor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the campaign's standing is the API's, read once the page is in the browser.
    void load();
  }, [load]);

  // A result takes focus once it is on screen: the button that was pressed may be gone.
  useEffect(() => {
    if (result) {
      status.current?.focus();
    }
  }, [result]);

  useEffect(() => {
    if (confirming) {
      confirmTitle.current?.focus();
    }
  }, [confirming]);

  function sayDateRefusal(refusal: NonNullable<ReturnType<typeof dateRefusal>>) {
    if ('campaignDate' in refusal) {
      // Another day already has a campaign: that day is the only one, so the field takes it and locks.
      setDate(refusal.campaignDate);
      setStanding({ date: refusal.campaignDate, state: 'open' });
      setDateError(interpolate(t.dateErrors.campaign_date, { date: day(refusal.campaignDate) }));
    } else {
      setDateError(t.dateErrors[refusal.code]);
    }

    requestAnimationFrame(() => field.current?.focus());
  }

  async function seeWho(offset = 0, moveFocus = true) {
    setPreviewError(undefined);

    if (date === '') {
      setDateError(t.dateErrors.required);
      field.current?.focus();

      return;
    }

    setPreviewing(true);

    try {
      const view = await previewFor(date, offset);

      setDateError(undefined);
      setPreview({ date, view });

      if (moveFocus) {
        requestAnimationFrame(() => counts.current?.focus());
      }
    } catch (caught) {
      const refusal = dateRefusal(caught);

      if (refusal) {
        setPreview(null);
        sayDateRefusal(refusal);
      } else {
        setPreviewError(messageFor(caught, dictionary));
      }
    } finally {
      setPreviewing(false);
    }
  }

  async function send() {
    if (!preview || sending) {
      return;
    }

    setSending(true);

    try {
      const answer = await api<NoticeSendView>(`/admin/notices/${NOTICE}/send`, {
        body: after === undefined ? { date: preview.date } : { after, date: preview.date },
        method: 'POST'
      });

      setAfter(answer.after ?? undefined);
      setConfirming(false);
      setResult(sentResult(answer, preview.date));
      setStanding({ date: preview.date, state: answer.remaining === 0 ? 'finished' : 'open' });
      // The counts and the list, read again for the same day; focus stays on the result.
      void seeWho(0, false);
    } catch (caught) {
      setConfirming(false);
      const refusal = dateRefusal(caught);

      if (refusal) {
        sayDateRefusal(refusal);
      } else if (caught instanceof ApiError && caught.code === 'NOTICE_DAILY_CAP' && caught.noticeCap) {
        const resets = Date.parse(caught.noticeCap.resetsAt);
        const at = (options: Intl.DateTimeFormatOptions) => formatInstant(resets, locale, { ...options, timeZone: 'Europe/Madrid' });

        setResult({
          body: interpolate(t.resultCap, {
            cap: number(caught.noticeCap.cap),
            day: at({ day: 'numeric', month: 'long' }),
            time: at({ hour: '2-digit', minute: '2-digit' })
          }),
          tone: 'warning'
        });
      } else if (caught instanceof ApiError && caught.code === 'CONFLICT') {
        setResult({ body: t.resultConflict, tone: 'warning' });
      } else {
        setResult({ body: messageFor(caught, dictionary), tone: 'error' });
      }
    } finally {
      setSending(false);
    }
  }

  function sentResult(answer: NoticeSendView, on: string): Result {
    const failed = answer.failedRecipients.map(recipient => recipient.email);

    return {
      body: (
        <Fragment>
          <span className={styles.line}>{interpolate(t.sent, { count: number(answer.sent) })}</span>
          {answer.failed > 0 ? (
            <span className={styles.line}>{interpolate(t.failed, { count: number(answer.failed), list: failed.join(', ') || '—' })}</span>
          ) : null}
          {answer.stoppedEarly ? <span className={styles.line}>{t.stoppedEarly}</span> : null}
          <span className={styles.line}>
            {answer.remaining === 0 ? interpolate(t.done, { date: day(on) }) : interpolate(t.remaining, { count: number(answer.remaining) })}
          </span>
        </Fragment>
      ),
      tone: answer.failed > 0 || answer.stoppedEarly ? 'warning' : 'success'
    };
  }

  if (loadFailed) {
    return (
      <div className={styles.campaign}>
        <Note as="p" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {t.loadError}
        </Note>
        <div className="button-row">
          <Button onClick={() => void load()} type="button" variant="secondary">
            {t.retry}
          </Button>
        </div>
      </div>
    );
  }

  const locked = standing !== null && standing.date !== null;
  const fresh = preview !== null && preview.date === date;
  const owed = fresh ? preview.view.toSend : 0;
  const batch = Math.min(NOTICE_BATCH_SIZE, owed);
  const closed = standing?.state === 'finished' || standing?.state === 'past';
  const written = (language: Locale2) => (fresh ? preview.view.dateAsWritten[language] : null);

  return (
    <div className={styles.campaign}>
      <BadgeStep number={1} title={t.steps.mail}>
        <Text size="sm" tone="secondary">
          {t.mailNote}
        </Text>
        <div className={styles.mails}>
          {(['es-ES', 'en-GB'] as const).map(language => (
            <NoticeMail
              date={written(language)}
              dateUnset={t.dateUnset}
              email={email}
              key={language}
              lang={language === 'es-ES' ? 'es' : 'en'}
              language={t.languages[language]}
              links={links[language]}
              subjectLabel={t.mailSubject}
              words={mail[language]}
            />
          ))}
        </div>
      </BadgeStep>

      <BadgeStep number={2} title={t.steps.date}>
        {standing === null ? (
          <Text role="status" size="sm" tone="secondary">
            {t.loading}
          </Text>
        ) : (
          <Fragment>
            <Input
              error={dateError}
              hint={locked && standing.date ? interpolate(t.dateLocked, { date: day(standing.date) }) : t.dateHint}
              label={t.dateLabel}
              max={addDays(today, NOTICE_MAX_DAYS_AHEAD)}
              min={tomorrow}
              onChange={event => {
                setDate(event.currentTarget.value);
                setDateError(undefined);
                setConfirming(false);
              }}
              readOnly={locked}
              ref={field}
              type="date"
              value={date}
            />
            <Note as="p" tone="warning" toneLabel={dictionary.common.noteTone.warning}>
              {t.reminder}
            </Note>
          </Fragment>
        )}
      </BadgeStep>

      <BadgeStep number={3} title={t.steps.who}>
        <div className="button-row">
          <Button
            aria-disabled={previewing || standing === null || undefined}
            loading={previewing}
            onClick={() => {
              if (!previewing && standing !== null) {
                void seeWho();
              }
            }}
            type="button"
            variant="secondary"
          >
            {t.preview}
          </Button>
        </div>

        {previewError ? (
          <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
            {previewError}
          </Note>
        ) : null}

        {preview ? (
          <div aria-label={t.counts} className={styles.counts} ref={counts} role="group" tabIndex={-1}>
            <dl className={styles.tiles}>
              <div>
                <dt>{t.toSend}</dt>
                <dd>{number(preview.view.toSend)}</dd>
              </div>
              <div>
                <dt>{t.alreadySent}</dt>
                <dd>{number(preview.view.alreadySent)}</dd>
              </div>
              <div>
                <dt>{t.skipped}</dt>
                <dd>{number(preview.view.skippedUnconfirmed)}</dd>
              </div>
            </dl>
            {preview.view.toSend === 0 ? (
              <Text size="sm">{preview.view.alreadySent > 0 ? interpolate(t.done, { date: day(preview.date) }) : t.nobody}</Text>
            ) : (
              <NoticeRecipients onPage={offset => void seeWho(offset, false)} pending={previewing} recipients={preview.view.recipients} />
            )}
          </div>
        ) : null}
      </BadgeStep>

      <BadgeStep number={4} title={t.steps.send}>
        {/* Mounted from the start, so every result is announced; it takes focus when one arrives. */}
        <div aria-label={t.status} className={styles.status} ref={status} role="status" tabIndex={-1}>
          {result ? (
            <Note as="p" tone={result.tone} toneLabel={dictionary.common.noteTone[result.tone]}>
              {result.body}
            </Note>
          ) : null}
        </div>

        {standing?.state === 'past' && standing.date ? (
          <Text>{interpolate(t.past, { date: day(standing.date) })}</Text>
        ) : standing?.state === 'finished' && standing.date ? (
          // Told to all: the last press's result already says so, in the region above; on arrival, this does.
          result ? null : (
            <Text>{interpolate(t.finished, { date: day(standing.date) })}</Text>
          )
        ) : !fresh ? (
          <Text size="sm" tone="secondary">
            {preview ? t.previewStale : t.previewFirst}
          </Text>
        ) : owed === 0 ? (
          <Text size="sm">{t.nobody}</Text>
        ) : confirming ? (
          <div className={styles.confirm} role="group">
            <h3 className={styles.confirmTitle} ref={confirmTitle} tabIndex={-1}>
              {t.confirmTitle}
            </h3>
            <Text>{interpolate(t.confirmBody, { count: number(batch), date: day(preview.date) })}</Text>
            <div className="button-row">
              <Button
                disabled={sending}
                onClick={() => {
                  setConfirming(false);
                  requestAnimationFrame(() => sendButton.current?.focus());
                }}
                type="button"
                variant="secondary"
              >
                {t.cancel}
              </Button>
              <Button aria-disabled={sending || undefined} loading={sending} onClick={() => void send()} type="button">
                {t.confirm}
              </Button>
            </div>
          </div>
        ) : (
          <Fragment>
            <Text size="sm" tone="secondary">
              {t.sendLead}
            </Text>
            <div className="button-row">
              <Button
                aria-disabled={closed || sending || undefined}
                onClick={() => {
                  if (!closed && !sending) {
                    setResult(null);
                    setConfirming(true);
                  }
                }}
                ref={sendButton}
                type="button"
              >
                {interpolate(t.send, { count: number(batch) })}
              </Button>
            </div>
          </Fragment>
        )}
      </BadgeStep>
    </div>
  );
}
