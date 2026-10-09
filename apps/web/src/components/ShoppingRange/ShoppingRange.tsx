'use client';
import styles from './ShoppingRange.module.css';

import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { formatDate } from 'lib/format';
import { hasWeeks } from 'lib/shoppingRange';

import type { RangeChoice, RangeSelection } from 'lib/shoppingRange';

interface ShoppingRangeProps {
  /** Every day the plan covers, in order. */
  days: readonly string[];
  onChange: (range: RangeSelection) => void;
  value: RangeSelection;
}

/**
 * Which days the list is for: the whole plan, either week, or days you pick.
 *
 * **Radios, not tabs and not links.** Each choice is a different reading of one
 * list, not a different page, and the filter must never reach the address bar:
 * the offline copy of this screen is keyed by path (`0053`), so a query string
 * would be a page the service worker never stored. Links would also put a
 * network request between a shopper and their own list.
 *
 * The day checkboxes appear only once "pick days" is chosen. Fourteen
 * checkboxes nobody asked for would be the loudest thing on a screen whose job
 * is a list, and the three presets are what most people want.
 */
export function ShoppingRange({ days, onChange, value }: ShoppingRangeProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const t = dictionary.shopping;
  // A plan too short to have a second week does not offer one.
  const presets: readonly { choice: RangeChoice; label: string }[] = [
    { choice: 'fortnight', label: t.rangeWhole },
    ...(hasWeeks(days)
      ? ([
          { choice: 'week1', label: t.rangeWeek1 },
          { choice: 'week2', label: t.rangeWeek2 }
        ] as const)
      : []),
    { choice: 'days', label: t.rangeDays }
  ];

  function pick(choice: RangeChoice) {
    // Picking "days" with nothing ticked yet starts from the days already on
    // screen, so the list never blinks empty on the way to a narrower range.
    onChange({ choice, days: choice === 'days' && value.days.length === 0 ? days : value.days });
  }

  function toggleDay(day: string) {
    const next = value.days.includes(day) ? value.days.filter(chosen => chosen !== day) : [...value.days, day];

    onChange({ choice: 'days', days: next });
  }

  return (
    <div className={styles.root}>
      {/*
        The legend is visible, not hidden. On `/compra` with a plan waiting for
        its day, the plan switch sits twelve pixels above this wearing the same
        pill recipe: two near-identical rows, one that navigates and one that
        filters, and "Actual / Próximo" reads as another time range if nothing
        says otherwise. The `<legend>` stays on the `<fieldset>` and the flex
        moves to the track inside it — a visible legend is laid out by the UA in
        its own way, and it fights a flex parent.
      */}
      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t.rangeLegend}</legend>
        <div className={styles.presets}>
          {presets.map(preset => (
            <label className={styles.preset} key={preset.choice}>
              <input
                checked={value.choice === preset.choice}
                className={styles.radio}
                id={`shopping-range-${preset.choice}`}
                name="shopping-range"
                onChange={() => pick(preset.choice)}
                type="radio"
                value={preset.choice}
              />
              <span className={styles.presetLabel}>{preset.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {value.choice === 'days' ? (
        <fieldset className={`${styles.days} motion-enter`}>
          <legend className={styles.daysLegend}>{t.rangeDaysLegend}</legend>
          <div className={styles.dayList}>
            {days.map(day => (
              <label className={styles.day} key={day}>
                <input checked={value.days.includes(day)} className={styles.checkbox} onChange={() => toggleDay(day)} type="checkbox" value={day} />
                {/* The plan's own date, formatted at local midnight like every other
                    date on these screens, so a day never reads as the one before. */}
                <span className={styles.dayLabel}>{formatDate(day, locale, { day: 'numeric', month: 'short', weekday: 'short' })}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
