import { useId } from 'react';

import styles from './StartDatePicker.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { ChipGroup } from 'components/ChipGroup';

import { formatDate, interpolate } from 'lib/format';

import type { AllowancesView } from 'core/controllers/Plan';

interface StartDatePickerProps {
  onChange: (date: string) => void;
  /** The API's eight days, today first, each one saying whether it costs a redo and whether one is left. */
  options: AllowancesView['startOptions'];
  /** The first day a redo is available again, when none is left. */
  redoNextAt: string | null;
  value: string;
}

/**
 * One answer out of eight: today, tomorrow, then the six days after, by weekday
 * and date. The days and what each costs come from the API, which counts them
 * in the person's own time zone; this only draws them and says, under the
 * group, what the chosen one does.
 */
export function StartDatePicker({ onChange, options, redoNextAt, value }: StartDatePickerProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.generation.startDate;
  const reasonId = useId();
  const day = (date: string) => formatDate(date, locale, { day: 'numeric', month: 'short', weekday: 'short' });
  const chosen = options.find(option => option.date === value);
  const spent = options.some(option => !option.allowed);

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t.legend}</legend>
      <ChipGroup
        name="startDate"
        options={options.map((option, offset) => ({
          describedBy: option.allowed || !redoNextAt ? undefined : reasonId,
          detail: !option.allowed ? t.noRedo : option.kind === 'redo' ? t.usesRedo : t.free,
          disabled: !option.allowed,
          label: offset === 0 ? `${t.today}, ${day(option.date)}` : offset === 1 ? `${t.tomorrow}, ${day(option.date)}` : day(option.date),
          value: option.date
        }))}
        single={{ choice: value, onChoose: onChange }}
      />
      {/* Said again in words whenever the choice changes, without moving focus. */}
      <Text aria-atomic="true" aria-live="polite" className={styles.note} size="sm" tone="secondary">
        {chosen
          ? `${interpolate(t.chosen, { date: formatDate(chosen.date, locale, { day: 'numeric', month: 'long', weekday: 'long' }) })}${chosen.kind === 'redo' ? ` ${t.redoNote}` : ''}`
          : ''}
      </Text>
      {spent && redoNextAt ? (
        <Text className={styles.note} id={reasonId} size="sm" tone="secondary">
          {interpolate(t.spentNote, { date: formatDate(redoNextAt, locale, { day: 'numeric', month: 'long' }) })}
        </Text>
      ) : null}
    </fieldset>
  );
}
