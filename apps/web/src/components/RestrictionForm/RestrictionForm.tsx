'use client';
import { useRef, useState } from 'react';

import styles from './RestrictionForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Note } from 'ui/components/Note';
import { RadioGroup, RadioGroupItem } from 'ui/components/RadioGroup';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { AdminSelect } from 'components/AdminSelect';
import { AdminTextArea } from 'components/AdminTextArea';
import { ChoiceSet } from 'components/ChoiceSet';
import { StatementPreview } from 'components/StatementPreview';

import { PRACTICE_CLOSE_NOTICE_DAYS, RESTRICTION_SOURCES, restrictPracticeSchema } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { formatInstant, interpolate } from 'lib/format';
import { restrictionStatement } from 'lib/ownerStatements';

import type { PracticeRestrictionAnswerView } from 'core/controllers/Professional';
import type { RestrictionSource } from 'core/entities/Professional';

interface RestrictionFormProps {
  /** Whether the practice is suspended already: a close announced over it says «es decir, suspendida». */
  alsoSuspended: boolean;
  /** `suspend` takes effect now; `close` runs its 30 days. */
  kind: 'close' | 'suspend';
  /** It went through: the answer, to say what stands now. */
  onDone: (answer: PracticeRestrictionAnswerView) => void;
  /** There was nothing to restrict any more. */
  onStale: () => void;
  userId: string;
}

/** How many days a close's notice runs, in milliseconds. */
const NOTICE_MS = PRACTICE_CLOSE_NOTICE_DAYS * 24 * 60 * 60 * 1000;

/** The sections a statement may cite beside the agreement's § 13: what the API's own schema accepts. */
// § 13 itself is not offered: the statement already cites it («§ 13…, en relación con su § n»).
const CLAUSES = Array.from({ length: 40 }, (_, index) => index + 1).filter(n => n !== 13 && restrictPracticeSchema.shape.clause.safeParse(n).success);

/**
 * Suspending an account as a practitioner, or announcing the close of its practice
 * (PRD 025 criterion 24; `docs/legal/textos/06` § W bis.1 and 3). One form for both —
 * the statement is the same — and what differs is said before the button: a suspension
 * takes effect now; a close runs 30 days from today, **its date shown here before the
 * owner confirms**, and respecting those 30 days is his: the console has no shorter
 * close. The consequence is stated in full — who sees what, what ends for good — and
 * below it the statement exactly as the person will read it: the owner picks the
 * source from the three approved sentences (naming the authority when it is one), and
 * may cite the section of the agreement read with its § 13.
 *
 * The API's own schema runs first, so an authority without a name or a source not
 * chosen is named on its field and nothing leaves the page.
 */
export function RestrictionForm({ alsoSuspended, kind, onDone, onStale, userId }: RestrictionFormProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.adminPractice;
  const acts = t.acts;
  const [facts, setFacts] = useState('');
  const [clause, setClause] = useState('');
  const [source, setSource] = useState<RestrictionSource>();
  const [authority, setAuthority] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'authority' | 'facts' | 'source', string>>>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // The day the notice would end if it were announced now: today plus 30 days, read once when the form opens.
  const [until] = useState(() => new Date(Date.now() + NOTICE_MS).toISOString());
  const root = useRef<HTMLFormElement>(null);
  const copy = kind === 'close' ? t.close : t.suspend;
  const day = (iso: string) => formatInstant(Date.parse(iso), locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid', year: 'numeric' });
  const sources = dictionary.practice.restrictionSources;

  const what =
    kind === 'close'
      ? interpolate(dictionary.practice.restrictionClosing, {
          closeDate: day(until),
          suspendedSuffix: alsoSuspended ? dictionary.practice.restrictionSuspendedSuffix : ''
        })
      : dictionary.adminStatements.suspend.what;
  const statement = restrictionStatement(dictionary, {
    authority: source === 'authority' ? authority : null,
    clause: clause === '' ? null : Number(clause),
    facts,
    source: source ?? 'own_review'
  });

  async function submit() {
    setError(undefined);

    const parsed = restrictPracticeSchema.safeParse({
      authority: source === 'authority' ? authority.trim() : undefined,
      clause: clause === '' ? undefined : Number(clause),
      facts: facts.trim(),
      source
    });

    if (!parsed.success) {
      const paths = new Set(parsed.error.issues.map(issue => issue.path[0]));

      setErrors({
        authority: paths.has('authority') ? acts.authorityRequired : undefined,
        facts: paths.has('facts') ? (facts.trim() === '' ? acts.factsRequired : acts.factsPlain) : undefined,
        source: paths.has('source') ? acts.sourceRequired : undefined
      });
      requestAnimationFrame(() => {
        (root.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? root.current?.querySelector<HTMLElement>('[role="radio"]'))?.focus();
      });

      return;
    }

    setErrors({});
    setPending(true);

    try {
      const answer = await api<PracticeRestrictionAnswerView>(
        `/admin/professionals/${encodeURIComponent(userId)}/${kind === 'close' ? 'close' : 'suspension'}`,
        { body: parsed.data, method: 'POST' }
      );

      onDone(answer);
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
      <Text weight="semibold">{kind === 'close' ? interpolate(t.close.date, { date: day(until) }) : t.suspend.lead}</Text>
      <Text size="sm">{kind === 'close' ? interpolate(t.close.consequence, { date: day(until) }) : t.suspend.consequence}</Text>
      {kind === 'close' ? <Text size="sm">{t.close.respect}</Text> : null}

      <AdminTextArea
        error={errors.facts}
        hint={acts.factsHint}
        label={acts.facts}
        maxLength={1000}
        onChange={event => {
          setFacts(event.currentTarget.value);
          setErrors(current => ({ ...current, facts: undefined }));
        }}
        value={facts}
      />

      <AdminSelect
        label={acts.clause}
        onChange={event => setClause(event.currentTarget.value)}
        options={[{ label: acts.clauseNone, value: '' }, ...CLAUSES.map(n => ({ label: interpolate(acts.clauseOption, { n }), value: String(n) }))]}
        value={clause}
      />
      <Text size="xs" tone="secondary">
        {acts.clauseHint}
      </Text>

      <ChoiceSet error={errors.source} legend={acts.legendSource}>
        <RadioGroup
          onValueChange={value => {
            setSource(value as RestrictionSource);
            setErrors(current => ({ ...current, source: undefined }));
          }}
          value={source ?? ''}
        >
          {RESTRICTION_SOURCES.map(option => (
            <RadioGroupItem
              key={option}
              label={interpolate(sources[option], { authority: authority.trim() === '' ? '…' : authority.trim() })}
              value={option}
            />
          ))}
        </RadioGroup>
      </ChoiceSet>

      {source === 'authority' ? (
        <Input
          autoComplete="off"
          error={errors.authority}
          hint={acts.authorityHint}
          label={acts.authority}
          lang="es"
          maxLength={160}
          onChange={event => {
            setAuthority(event.currentTarget.value);
            setErrors(current => ({ ...current, authority: undefined }));
          }}
          value={authority}
        />
      ) : null}

      {/* Only once it can be read whole: an authority named, not «Nos lo exige ….». */}
      {source && (source !== 'authority' || authority.trim() !== '') ? (
        <StatementPreview note={acts.previewNote} title={acts.preview} what={what} why={statement} />
      ) : null}

      {error ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {error}
        </Note>
      ) : null}

      <div className="button-row">
        <Button aria-disabled={pending || undefined} loading={pending} type="submit" variant="destructive">
          {copy.submit}
        </Button>
      </div>
    </form>
  );
}
