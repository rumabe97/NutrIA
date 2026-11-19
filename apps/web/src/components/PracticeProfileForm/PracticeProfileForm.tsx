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

import { PRICE_UNITS, PROFILE_HOURS_RANGES_MAX } from 'core/entities/Professional';

import { api, ApiError, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';
import { wordRefusal } from 'lib/protectedWord';

import type { PriceUnit, ProfessionalHours } from 'core/entities/Professional';
import type { ProfessionalProfileView } from 'core/controllers/Professional';

interface PracticeProfileFormProps {
  /** The profile as saved, or null before the first save. */
  profile: ProfessionalProfileView | null;
}

type Range = { from: string; to: string };

const DAYS = 7;
const CENTS = 100;

function emptyWeek(): Range[][] {
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
 * The hours are display only (`0110` decision 9): up to six ranges a day, a day
 * with none is closed.
 */
export function PracticeProfileForm({ profile }: PracticeProfileFormProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.practice;
  const id = useId();
  const withheld = Object.fromEntries((profile?.withheld ?? []).map(word => [word.field, wordRefusal(`${word.list}:${word.word}`, t) ?? undefined]));
  const [hours, setHours] = useState<Range[][]>(() => (profile?.hours ? profile.hours.map(day => day.map(range => ({ ...range }))) : emptyWeek()));
  const [unit, setUnit] = useState<PriceUnit>(profile?.priceUnit ?? 'consultation');
  const [errors, setErrors] = useState<Partial<Record<'displayName' | 'hours' | 'price' | 'studies', string>>>(withheld);
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

  function changeRange(day: number, index: number, edge: keyof Range, value: string) {
    setHours(week => week.map((ranges, d) => (d === day ? ranges.map((range, i) => (i === index ? { ...range, [edge]: value } : range)) : ranges)));
  }

  function addRange(day: number) {
    setHours(week => week.map((ranges, d) => (d === day ? [...ranges, { from: '09:00', to: '14:00' }] : ranges)));
  }

  function removeRange(day: number, index: number) {
    setHours(week => week.map((ranges, d) => (d === day ? ranges.filter((_range, i) => i !== index) : ranges)));
  }

  async function save(form: FormData) {
    setSaved(false);
    setSummary(undefined);

    const priceCents = centsOf(String(form.get('price') ?? ''));
    const studies = String(form.get('studies') ?? '').trim();

    if (Number.isNaN(priceCents)) {
      setErrors({ price: dictionary.errors.invalidInput });
      setSummary(dictionary.errors.invalidInput);
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
        const field = (name: string) => caught.fieldErrors[name]?.[0];
        const next: typeof errors = {};

        for (const name of ['displayName', 'studies'] as const) {
          const code = field(name);

          if (code) {
            next[name] = wordRefusal(code, t) ?? dictionary.errors.invalidInput;
          }
        }

        if (field('priceCents') || field('priceUnit')) {
          next.price = dictionary.errors.invalidInput;
        }

        if (Object.keys(caught.fieldErrors).some(key => key.startsWith('hours'))) {
          next.hours = dictionary.errors.invalidInput;
        }

        setErrors(next);
        setRefusals(count => count + 1);
      }

      setSummary(messageFor(caught, dictionary));
    } finally {
      setPending(false);
    }
  }

  const studiesHint = `${id}-studies-hint`;
  const studiesError = `${id}-studies-error`;
  const hoursTitle = `${id}-hours`;

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
          <Input defaultValue={priceText(profile?.priceCents ?? null)} error={errors.price} inputMode="decimal" label={t.profilePrice} name="price" />
          <div className={styles.field}>
            <span className={styles.label} id={`${id}-unit`}>
              {t.profilePriceUnitLabel}
            </span>
            <Select aria-labelledby={`${id}-unit`} onValueChange={value => setUnit(value as PriceUnit)} value={unit}>
              {PRICE_UNITS.map(option => (
                <SelectOption indicator="✓" key={option} value={option}>
                  {t.profilePriceUnit[option]}
                </SelectOption>
              ))}
            </Select>
          </div>
        </div>
        <Text size="xs" tone="tertiary">
          {t.profilePriceNote}
        </Text>
      </Card>

      <Card aria-labelledby={hoursTitle} as="section" className={styles.card}>
        <h2 className={styles.cardTitle} id={hoursTitle}>
          {t.profileHours}
        </h2>
        <ul className={styles.days}>
          {hours.map((ranges, day) => {
            const name = dictionary.fixedMeals.weekdays[day] ?? '';

            return (
              <li className={styles.day} key={name}>
                <div className={styles.dayHead}>
                  <span className={styles.dayName}>{name}</span>
                  {ranges.length === 0 ? (
                    <Text as="span" className={styles.closed} size="sm" tone="secondary">
                      {t.profileHoursClosed}
                    </Text>
                  ) : null}
                  {ranges.length < PROFILE_HOURS_RANGES_MAX ? (
                    <Button
                      aria-label={interpolate(t.profileHoursAdd, { day: dictionary.fixedMeals.weekdaysInSentence[day] ?? name })}
                      className={styles.add}
                      onClick={() => addRange(day)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {dictionary.common.add}
                    </Button>
                  ) : null}
                </div>
                {ranges.map((range, index) => (
                  // The index is the range's place in a list only this form reorders.
                  // eslint-disable-next-line react/no-array-index-key
                  <fieldset className={styles.range} key={index}>
                    <legend className="visually-hidden">{name}</legend>
                    <Input
                      label={t.profileHoursFrom}
                      onChange={event => changeRange(day, index, 'from', event.target.value)}
                      type="time"
                      value={range.from}
                    />
                    <Input
                      label={t.profileHoursTo}
                      onChange={event => changeRange(day, index, 'to', event.target.value)}
                      type="time"
                      value={range.to}
                    />
                    <Button className={styles.remove} onClick={() => removeRange(day, index)} size="sm" type="button" variant="tertiary">
                      {t.profileHoursRemove}
                    </Button>
                  </fieldset>
                ))}
              </li>
            );
          })}
        </ul>
        {errors.hours ? (
          <Text className={styles.error} size="xs">
            {errors.hours}
          </Text>
        ) : null}
        <Text size="xs" tone="tertiary">
          {t.profileHoursNote}
        </Text>
      </Card>

      {summary ? (
        <Note as="p" layout="inline" role="alert" tone="error" toneLabel={dictionary.common.noteTone.error}>
          {summary}
        </Note>
      ) : null}
      {saved ? (
        <Note as="p" className="motion-drop-in" role="status" tone="success" toneLabel={dictionary.common.noteTone.success}>
          {t.profileSaved}
        </Note>
      ) : null}

      <div className={styles.actions}>
        <Button loading={pending} size="lg" type="submit">
          {dictionary.common.save}
        </Button>
      </div>
    </form>
  );
}
