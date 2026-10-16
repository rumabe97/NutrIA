'use client';
import { useState } from 'react';

import styles from './KitchenPicker.module.css';

import { Text } from 'ui/components/Text';
import { useDictionary } from 'i18n/LocaleProvider';

import { ChipGroup } from 'components/ChipGroup';

import { APPLIANCES, DEFAULT_KITCHEN, EQUIPMENT_STANCES } from 'core/entities/Kitchen';

import { interpolate } from 'lib/format';

import type { Appliance, EquipmentStance } from 'core/entities/Kitchen';
import type { Chip } from 'components/ChipGroup';
import type { KitchenView } from 'core/controllers/Kitchen';

/**
 * The ids the reasons live at. Visible text, pointed at by the chips that cannot
 * be chosen — `ChipGroup` draws those `aria-disabled` rather than `disabled`
 * precisely so the reason stays reachable by keyboard.
 */
const BOUND_ID = 'kitchen-preference-bound';
const HOB_ID = 'kitchen-hob-note';

interface KitchenPickerProps {
  /** As `GET /profile` answers it: every appliance with a stance, whether anybody said so, and the bound. */
  kitchen: KitchenView;
}

/**
 * What somebody's kitchen has, lacks, and what they would rather cook with
 * (`0102`) — one row per appliance, three answers, and the default shown as a
 * default.
 *
 * **A kitchen nobody has described is not a filled-in form.** A row whose
 * stance is the one `DEFAULT_KITCHEN` supplies has no chip chosen: it says in
 * words what we assume instead ("por defecto, sí"), so a normal kitchen reads
 * as an assumption somebody can correct rather than as ten answers they gave.
 * Only the rows that differ from it are chosen, and only the rows somebody
 * touches are submitted — a stance stored is a stance frozen, and the default
 * has to stay free to change under people who never had an opinion about it
 * (the blender was added to it a day before this screen was built).
 *
 * The comparison is against the default rather than against a list of what was
 * actually said, because `KitchenView` does not carry one: it folds the
 * default onto all ten and `described` only says whether *anything* was said.
 * The one thing the inference gets wrong is a person who deliberately agreed
 * with the default — they see it offered as the default again, which is what
 * the row means either way, and their stored row is left exactly as it is.
 *
 * **The bound is said before it is hit.** `maxPreferred` comes from the payload
 * rather than from the constant, the count is live, and once it is spent every
 * other `prefers` is visibly unavailable with the reason beside it — not a tap
 * that comes back 422. The API still enforces it; this only means nobody meets
 * that refusal by following the screen.
 *
 * Plain radios under `ChipGroup`, so the enclosing form reads the answers out of
 * its own `FormData` and there is no second copy of the state to drift.
 */
export function KitchenPicker({ kitchen }: KitchenPickerProps) {
  const dictionary = useDictionary();
  const t = dictionary.kitchen;
  // `undefined` for a row is "nobody has answered this one", which is what
  // keeps it out of the submission and keeps its default marker on screen.
  const [stances, setStances] = useState<Partial<Record<Appliance, EquipmentStance>>>(() =>
    Object.fromEntries(
      APPLIANCES.filter(appliance => kitchen.appliances[appliance] !== DEFAULT_KITCHEN[appliance]).map(appliance => [
        appliance,
        kitchen.appliances[appliance]
      ])
    )
  );
  const preferred = APPLIANCES.filter(appliance => stances[appliance] === 'prefers').length;
  const spent = preferred >= kitchen.maxPreferred;

  /**
   * `ChipGroup` hands back the chosen chip's value as a string; the stance is
   * recovered from the catalogue rather than asserted, so nothing here casts.
   */
  function choose(appliance: Appliance, value: string): void {
    const stance = EQUIPMENT_STANCES.find(candidate => candidate === value);

    if (stance) {
      setStances(current => ({ ...current, [appliance]: stance }));
    }
  }

  function optionsFor(appliance: Appliance): readonly Chip[] {
    return EQUIPMENT_STANCES.map(stance => {
      // Re-stating a preference somebody already has is never the fourth one —
      // the same arithmetic the repository does inside its lock.
      const beyondBound = stance === 'prefers' && spent && stances[appliance] !== 'prefers';
      // The hob is the one appliance nobody may say they lack: a kitchen
      // without one keeps 43 dishes of 1128 and no plan can be built at all.
      const withoutAHob = appliance === 'stovetop' && stance === 'missing';

      return {
        // The appliance is in the `legend`, which is read on arriving at the
        // group and not on swiping between controls or using the form-controls
        // rotor — so without this a phone offers ten identical triplets
        // (`accessibility`, 2026-10-16). The visible label does not change.
        ariaLabel: `${t.appliances[appliance]}: ${t.stances[stance]}`,
        describedBy: withoutAHob ? HOB_ID : beyondBound ? BOUND_ID : undefined,
        disabled: withoutAHob || beyondBound,
        label: t.stances[stance],
        value: stance
      };
    });
  }

  return (
    <div className={styles.picker}>
      <Text size="sm" tone="secondary">
        {t.intro}
      </Text>
      <Text size="xs" tone="tertiary">
        {t.preferredHint}
      </Text>
      {/* Mounted with the count already in it rather than empty: it is the
          reason a chip cannot be chosen, and a reason that only exists after
          the change is a reason nobody can read beforehand. */}
      {/* `role="status"` is already a polite live region; both attributes together
          make some pairings announce it twice (`accessibility`, 2026-10-16). */}
      <Text className={styles.bound} id={BOUND_ID} role="status" size="xs" tone="secondary">
        {spent
          ? interpolate(t.preferredFull, { max: kitchen.maxPreferred })
          : interpolate(t.preferredCount, { count: preferred, max: kitchen.maxPreferred })}
      </Text>

      <div className={styles.rows}>
        {APPLIANCES.map(appliance => (
          <fieldset className={styles.row} key={appliance}>
            <legend className={styles.appliance}>
              {t.appliances[appliance]}
              {/* Only while this row is whatever the default says, and gone the
                  moment somebody answers it. */}
              {stances[appliance] === undefined ? (
                /* Parenthesised so a screen reader does not read "Fuego por
                   defecto, sí" as one run-on phrase (`accessibility`). */
                <span className={styles.assumed}>({DEFAULT_KITCHEN[appliance] === 'missing' ? t.defaultMissing : t.defaultHas})</span>
              ) : null}
            </legend>
            <ChipGroup
              name={`kitchen.${appliance}`}
              options={optionsFor(appliance)}
              single={{ choice: stances[appliance] ?? '', onChoose: value => choose(appliance, value) }}
            />
            {appliance === 'stovetop' ? (
              <Text className={styles.note} id={HOB_ID} size="xs" tone="tertiary">
                {t.stovetopFixed}
              </Text>
            ) : null}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
