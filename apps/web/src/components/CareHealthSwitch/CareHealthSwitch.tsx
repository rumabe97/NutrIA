'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useDictionary } from 'i18n/LocaleProvider';

import { SettingSwitch } from 'components/SettingSwitch';

import { api, messageFor } from 'lib/api';
import { withProfessional } from 'lib/professionalName';

import type { CareLinkView } from 'core/controllers/Care';

/**
 * The client's own health line (`docs/legal/textos/05-consentimientos-cliente.md`
 * § B2, P0-1): share or stop sharing conditions, medications and supplements
 * with the linked professional, without ending the link. Optimistic, like
 * `CareReviewSwitch`: the switch moves at once and goes back if the request
 * fails. `router.refresh()` re-reads the link so `CareLinkCard`'s own "what is
 * shared" line catches up with the new list.
 */
interface CareHealthSwitchProps {
  /** The practitioner's name as it may be shown, or null for «tu profesional». */
  professionalName: string | null;
  sharesHealth: boolean;
  /**
   * Whether the practitioner can see the health line now (a `full` scope). A line left on
   * under a plan-only link stays so it can be taken back, with no hint saying anybody sees it.
   */
  visible: boolean;
}

export function CareHealthSwitch({ professionalName, sharesHealth, visible }: CareHealthSwitchProps) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.care;
  const [checked, setChecked] = useState(sharesHealth);
  const [error, setError] = useState<string>();

  async function flip(next: boolean) {
    setChecked(next);
    setError(undefined);

    try {
      const link = await api<CareLinkView>('/care/links/me', { body: { sharesHealth: next }, method: 'PATCH' });

      setChecked(link.sharesHealth);
      router.refresh();
    } catch (caught) {
      setChecked(!next);
      setError(messageFor(caught, dictionary));
    }
  }

  return (
    <SettingSwitch
      checked={checked}
      error={error}
      hint={visible ? withProfessional(checked ? t.healthShareOnHint : t.healthShareOffHint, professionalName, t.professionalUnnamed) : undefined}
      label={t.healthShareToggle}
      onCheckedChange={next => void flip(next)}
    />
  );
}
