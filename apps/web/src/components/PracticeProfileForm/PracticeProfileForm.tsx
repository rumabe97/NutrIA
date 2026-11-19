'use client';
import { useEffect, useId, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './PracticeProfileForm.module.css';

import { Button } from 'ui/components/Button';
import { Input } from 'ui/components/Input';
import { Note } from 'ui/components/Note';
import { Select, SelectOption } from 'ui/components/Select';
import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { Card } from 'components/Card';
import { PracticeHoursEditor } from 'components/PracticeHoursEditor';

import { PRICE_UNITS, PROFILE_STUDIES_MAX } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';
import { profileRefusals } from 'lib/profileRefusals';
import { wordRefusal } from 'lib/protectedWord';

import type { HoursRange } from 'components/PracticeHoursEditor';
import type { PriceUnit, ProfessionalHours } from 'core/entities/Professional';
import type { ProfessionalProfileView } from 'core/controllers/Professional';

interface PracticeProfileFormProps {
  /** The profile as saved, or null before the first save. */
  profile: ProfessionalProfileView | null;
}

const DAYS = 7;
const CENTS = 100;

function emptyWeek(): HoursRange[][] {
  return Array.from({ length: DAYS }, () => []);
}

/** "30", "30,5", "30.50 €" → cents; null for nothing typed; NaN for anything else. */
function centsOf(text: string): number | null {
  const clean = text.replace(/[\s€]/g, '').replace(',', '.');

  if (clean === '') {
    return null;
  }

  return /^\d+(\.\d{1,2})?$/.test(clean) ? Math.round(Number(clean) * CENTS) : Number.NaN;
}

function priceText(cents: number | null): string {
  if (cents === null) {
    return '';
  }

  const whole = Math.floor(cents / CENTS);
  const rest = cents % CENTS;

  return rest === 0 ? String(whole) : `${String(whole)},${String(rest).padStart(2, '0')}`;
}

/**
 * The practitioner's profile (PRD 025 scope 4; sheet «EditarPerfil»): the name
 * shown, the studies, the final price with its unit and the hours, in the
 * approved labels of `docs/legal/textos/01` § Pantallas P4. The whole profile
 * is saved every time (`PUT /care/practice/profile`).
 *
 * **The words are the server's to judge**, with the badge as it stands: a
 * refusal comes back as `fieldErrors.<field>: ['<list>:<word>']` and is drawn
 * on that field, in the approved sentence for its list — badge-only, a title
 * nobody may claim, a promised result (`lib/protectedWord`). A field the API
 * withholds now (a badge-only word after the badge went) carries the same
 * sentence until it is edited.
 *
 * The hours are `PracticeHoursEditor`. A refusal that is not a word gets the plain
 * instruction for its field (`practice.fieldError`), and the first refused field
 * takes focus.
 */
export function PracticeProfileForm({ profile }: PracticeProfileFormProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.practice;
  const id = useId();
  const withheld = Object.fromEntries((profile?.withheld ?? []).map(word => [word.field, wordRefusal(`${word.list}:${word.word}`, t) ?? undefined]));
  const [hours, setHours] = useState<HoursRange[][]>(() =>
    profile?.hours ? profile.hours.map(day => day.map(range => ({ ...range }))) : emptyWeek()
  );
  const [unit, setUnit] = useState<PriceUnit>(profile?.priceUnit ?? 'consultation');
  const [errors, setErrors] = useState<Partial<Record<'displayName' | 'price' | 'studies', string>>>(withheld);
  const [hoursError, setHoursError] = useState<{ day: number; text: string } | null>(null);
  const [summary, setSummary] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  // Bumped by each refusal: the first field it marks takes focus, so the reason is where the reader is.
  const [refusals, setRefusals] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (refusals > 0) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [refusals]);

  /** The first day with a range: where a refusal of the hours that names no day is shown. */
  function firstOpenDay(): number {
    return Math.max(
      hours.findIndex(day => day.length > 0),
      0
    );
  }

  function hoursRefusal(day: number) {
    const name = dictionary.fixedMeals.weekdaysInSentence[day] ?? '';

    return { day, text: interpolate(t.fieldError.hours, { day: name }) };
  }

  async function save(form: FormData) {
    setSaved(false);
    setSummary(undefined);
    setHoursError(null);

    const priceCents = centsOf(String(form.get('price') ?? ''));
    const studies = String(form.get('studies') ?? '').trim();
    const badRange = hours.findIndex(day => day.some(range => !range.from || !range.to || range.from >= range.to));

    if (Number.isNaN(priceCents) || badRange >= 0) {
      setErrors(Number.isNaN(priceCents) ? { price: t.fieldError.price } : {});
      setHoursError(badRange >= 0 ? hoursRefusal(badRange) : null);
      setRefusals(count => count + 1);

      return;
    }

    setErrors({});
    setPending(true);

    const week: ProfessionalHours = hours;

    try {
      await api('/care/practice/profile', {
        body: {
          displayName: String(form.get('displayName') ?? '').trim(),
          hours: week.some(day => day.length > 0) ? week : null,
          priceCents,
          priceUnit: priceCents === null ? null : unit,
          studies: studies === '' ? null : studies
        },
        method: 'PUT'
      });
      setSaved(true);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_INPUT') {
        // Every refused field on its own field (`lib/profileRefusals`); the first takes focus.
        const { hoursDay, ...next } = profileRefusals(caught.fieldErrors, t, PROFILE_STUDIES_MAX);

        setHoursError(hoursDay === undefined ? null : hoursRefusal(hoursDay ?? firstOpenDay()));
        setErrors(next);
        setRefusals(count => count + 1);
      } else {
        setSummary(messageFor(caught, dictionary));
      }
    } finally {
      setPending(false);
    }
  }

  const studiesHint = `${id}-studies-hint`;
  const studiesError = `${id}-studies-error`;
  const priceNote = `${id}-price-note`;
  const unitLabel = `${id}-unit`;

  return (
    <form
      className={styles.form}
      noValidate={true}
      onSubmit={event => {
        event.preventDefault();
        void save(new FormData(event.currentTarget));
      }}
      ref={formRef}
    >
      <Card as="section" className={styles.card}>
        <Input
          autoComplete="name"
          defaultValue={profile?.displayName ?? ''}
          error={errors.displayName}
          label={t.profileName}
          name="displayName"
          required={true}
        />

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-studies`}>
            {t.profileStudies}
          </label>
          <textarea
            aria-describedby={errors.studies ? studiesError : studiesHint}
            aria-invalid={errors.studies ? true : undefined}
            className={errors.studies ? `${styles.textarea} ${styles.invalid}` : styles.textarea}
            defaultValue={profile?.studies ?? ''}
            id={`${id}-studies`}
            name="studies"
            rows={4}
          />
          {errors.studies ? (
            <Text className={styles.error} id={studiesError} size="xs">
              {errors.studies}
            </Text>
          ) : (
            <Text id={studiesHint} size="xs" tone="tertiary">
              {t.profileStudiesNote}
            </Text>
          )}
        </div>
      </Card>

      <Card as="section" className={styles.card}>
        <div className={styles.price}>
          <Input
            defaultValue={priceText(profile?.priceCents ?? null)}
            describedBy={priceNote}
            error={errors.price}
            inputMode="decimal"
            label={t.profilePrice}
            name="price"
          />
          <div className={styles.field}>
            <span className={styles.label} id={unitLabel}>
              {t.profilePriceUnitLabel}
            </span>
            <Select aria-describedby={priceNote} aria-labelledby={unitLabel} onValueChange={value => setUnit(value as PriceUnit)} value={unit}>
              {PRICE_UNITS.map(option => (
                <SelectOption indicator="✓" key={option} value={option}>
                  {t.profilePriceUnit[option]}
                </SelectOption>
              ))}
            </Select>
          </div>
        </div>
        <Text id={priceNote} size="xs" tone="tertiary">
          {t.profilePriceNote}
        </Text>
      </Card>

      <PracticeHoursEditor error={hoursError?.text} errorDay={hoursError?.day ?? null} hours={hours} onChange={setHours} />

      {summary ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {summary}
        </Note>
      ) : null}
      {/* Mounted from the start and filled after a save, so the status is announced. */}
      <div role="status">
        {saved ? (
          <Note as="p" className="motion-drop-in" tone="success" toneLabel={dictionary.common.noteTone.success}>
            {t.profileSaved}
          </Note>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button aria-disabled={pending || undefined} loading={pending} size="lg" type="submit">
          {dictionary.common.save}
        </Button>
      </div>
    </form>
  );
}
