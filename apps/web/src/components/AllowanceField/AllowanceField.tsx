'use client';
import { useId, useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './AllowanceField.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { api, messageFor } from 'lib/api';
import { interpolate } from 'lib/format';

import type { AllowanceName, Tier } from 'core/domain/Allowance';

type AllowanceFieldProps = {
  /** The highest the console may set it, from the registry. */
  readonly ceiling: number;
  readonly floor: number;
  readonly label: string;
  /** Which limit, by the registry's name. The API rejects anything the registry does not declare. */
  readonly name: AllowanceName;
  /** What it is with nothing stored, so the field can say when it has been moved away from it. */
  readonly shipped: number;
  readonly tier: Tier;
  readonly value: number;
};

/**
 * One limit, for one tier, on `/admin` (`0097`).
 *
 * A form rather than a switch that writes as you type: a number is wrong on the
 * way to being right — 1, 12, 120 are all typed on the way to 12 — and a field
 * that saved each of them would have granted a hundred and twenty of something
 * for as long as it took to finish typing.
 *
 * It does not clamp. A value outside the bounds is refused by the API with the
 * ceiling's own reason, and what the reader typed stays on screen: a clamp
 * answers a number nobody asked for, and the field would then read back as
 * though it had been their decision.
 *
 * The ceiling and the shipped default are passed in rather than looked up here:
 * the registry in `core/domain/Allowance` is the one authority on both, and a
 * console holding its own copy would be a second one. The *reason* for the
 * ceiling is read once by the row above, not twice here — it belongs to the
 * limit, and both tiers share it.
 */
export function AllowanceField({ ceiling, floor, label, name, shipped, tier, value }: AllowanceFieldProps) {
  const dictionary = useDictionary();
  const router = useRouter();
  const words = dictionary.adminAllowances;
  const fieldId = useId();
  const hintId = useId();
  const [typed, setTyped] = useState(String(value));
  const [saved, setSaved] = useState(value);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(event: { preventDefault: () => void }) {
    event.preventDefault();

    // An empty field is not a zero. `Number('')` is 0 and would store it, which is
    // the one direction a slip must not take silently.
    const next = typed.trim() === '' ? Number.NaN : Number(typed);

    if (!Number.isInteger(next)) {
      setError(words.whole);

      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      await api('/admin/settings/allowances', { body: { name, tier, value: next }, method: 'PATCH' });
      setSaved(next);
      // The other tier's field, and this one, are read again from the server: one
      // number can move another (premium is never below free), and a field showing
      // what it sent rather than what is in force would hide exactly that.
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, dictionary));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.root} onSubmit={event => void save(event)}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <div className={styles.line}>
        <input
          aria-describedby={hintId}
          className={styles.field}
          disabled={busy}
          id={fieldId}
          inputMode="numeric"
          max={ceiling}
          min={floor}
          onChange={event => setTyped(event.target.value)}
          step={1}
          type="number"
          value={typed}
        />
        <button className={styles.save} disabled={busy || typed === String(saved)} type="submit">
          {words.save}
        </button>
      </div>
      <Text id={hintId} size="xs" tone="tertiary">
        {interpolate(words.bounds, { ceiling: String(ceiling), floor: String(floor), shipped: String(shipped) })}
      </Text>
      {error ? (
        <Text className={styles.error} size="xs">
          {error}
        </Text>
      ) : null}
    </form>
  );
}
