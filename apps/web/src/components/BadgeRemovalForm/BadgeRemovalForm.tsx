'use client';
import { useEffect, useId, useRef, useState } from 'react';

import styles from './BadgeRemovalForm.module.css';

import { Button } from 'ui/components/Button';
import { Note } from 'ui/components/Note';
import { RadioGroup, RadioGroupItem } from 'ui/components/RadioGroup';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { AdminTextArea } from 'components/AdminTextArea';
import { ChoiceSet } from 'components/ChoiceSet';
import { StatementPreview } from 'components/StatementPreview';

import { BADGE_REMOVAL_REASONS, BADGE_REMOVAL_SOURCES, removeBadgeSchema } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { badgeRemovalStatement } from 'lib/ownerStatements';
import { formatInstant, interpolate } from 'lib/format';

import type { BadgeRecordView } from 'core/controllers/Professional';
import type { BadgeRemovalReason, BadgeRemovalSource } from 'core/entities/Professional';

interface BadgeRemovalFormProps {
  /** The college and the number of the check being decided: the application's, or the standing badge's. */
  decided: { number: string; register: string };
  /** `fail` for a request not given; `withdrawn` for a badge taken back. */
  kind: 'fail' | 'withdrawn';
  onCancel: () => void;
  /** It went through, and the page reads the record again; or there was nothing of that kind to decide. */
  onDone: (outcome: 'done' | 'stale') => void;
  record: Pick<BadgeRecordView, 'userId'>;
  /** The id the opening button names in `aria-controls`. */
  rootId: string;
}

/**
 * Not giving a badge, or taking one back (`docs/legal/textos/06` § W): the closed
 * reasons the owner picks from — each choice is the approved sentence the person will
 * read, filled in with the college, the number and today's date — the facts he adds
 * (they are the whole reason when he picks «otro»), and where the decision comes from.
 * Below, the statement as the person receives it, and what the act does, before the
 * button that does it. Nothing is preselected: a statement of reasons is a decision.
 *
 * `removeBadgeSchema`, the API's own, runs first: «otro» without facts, an empty
 * choice, a pair of markup characters are named on their field.
 */
export function BadgeRemovalForm({ decided, kind, onCancel, onDone, record, rootId }: BadgeRemovalFormProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminBadge.removal;
  const [reason, setReason] = useState<BadgeRemovalReason>();
  const [source, setSource] = useState<BadgeRemovalSource>();
  const [facts, setFacts] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'facts' | 'reason' | 'source', string>>>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // The day the check is written: read once, when the form opens, so the sentence the owner reads does not change under him.
  const [now] = useState(() => Date.now());
  const today = formatInstant(now, locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const sentences = dictionary.practice.badgeReasons;
  const sources = dictionary.adminStatements.badge.sources;

  useEffect(() => {
    root.current?.querySelector<HTMLElement>('button, textarea')?.focus();
  }, []);

  const statement = badgeRemovalStatement(dictionary, {
    checkedOn: today,
    facts,
    kind,
    number: decided.number,
    reason: reason ?? 'other',
    register: decided.register,
    source: source ?? 'own_check'
  });

  async function submit() {
    setError(undefined);

    const parsed = removeBadgeSchema.safeParse({ facts: facts.trim() === '' ? undefined : facts.trim(), kind, reason, source });

    if (!parsed.success) {
      const paths = new Set(parsed.error.issues.map(issue => issue.path[0]));

      setErrors({
        facts: paths.has('facts') ? (reason === 'other' && facts.trim() === '' ? t.factsRequired : t.factsPlain) : undefined,
        reason: paths.has('reason') ? t.reasonRequired : undefined,
        source: paths.has('source') ? t.sourceRequired : undefined
      });
      requestAnimationFrame(() => {
        (root.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? root.current?.querySelector<HTMLElement>('[role="radio"]'))?.focus();
      });

      return;
    }

    setErrors({});
    setPending(true);

    try {
      await api(`/admin/professionals/${encodeURIComponent(record.userId)}/badge/removal`, { body: parsed.data, method: 'POST' });
      onDone('done');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'NOT_FOUND') {
        onDone('stale');
      } else {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div aria-labelledby={titleId} className={styles.form} id={rootId} ref={root} role="group">
      <h3 className={styles.title} id={titleId}>
        {kind === 'fail' ? t.titleFail : t.titleWithdrawn}
      </h3>

      <ChoiceSet error={errors.reason} legend={t.legendReason}>
        <RadioGroup
          aria-label={t.legendReason}
          onValueChange={value => {
            setReason(value as BadgeRemovalReason);
            setErrors(current => ({ ...current, facts: undefined, reason: undefined }));
          }}
          value={reason ?? ''}
        >
          {BADGE_REMOVAL_REASONS.map(option => (
            <RadioGroupItem
              key={option}
              label={
                option === 'other'
                  ? t.other
                  : interpolate(sentences[option], { checkedOn: today, number: decided.number, register: decided.register })
              }
              value={option}
            />
          ))}
        </RadioGroup>
      </ChoiceSet>

      <AdminTextArea
        error={errors.facts}
        hint={t.factsHint}
        label={t.factsLabel}
        maxLength={1000}
        onChange={event => {
          setFacts(event.currentTarget.value);
          setErrors(current => ({ ...current, facts: undefined }));
        }}
        value={facts}
      />

      <ChoiceSet error={errors.source} legend={t.legendSource}>
        <RadioGroup
          aria-label={t.legendSource}
          onValueChange={value => {
            setSource(value as BadgeRemovalSource);
            setErrors(current => ({ ...current, source: undefined }));
          }}
          value={source ?? ''}
        >
          {BADGE_REMOVAL_SOURCES.map(option => (
            <RadioGroupItem key={option} label={sources[option]} value={option} />
          ))}
        </RadioGroup>
      </ChoiceSet>

      {reason && source ? <StatementPreview note={t.previewNote} title={t.preview} what={statement.what} why={statement.why} /> : null}

      <Text size="sm">{kind === 'fail' ? t.consequenceFail : t.consequenceWithdrawn}</Text>

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      <div className="button-row">
        <Button disabled={pending} onClick={onCancel} type="button" variant="secondary">
          {dictionary.common.cancel}
        </Button>
        <Button aria-disabled={pending || undefined} loading={pending} onClick={() => void submit()} type="button" variant="destructive">
          {kind === 'fail' ? t.submitFail : t.submitWithdrawn}
        </Button>
      </div>
    </div>
  );
}
