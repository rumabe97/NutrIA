'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useDictionary } from 'i18n/LocaleProvider';

import { SettingSwitch } from 'components/SettingSwitch';

import { api, ApiError, messageFor } from 'lib/api';

import type { CareClientLinkView } from 'core/controllers/Care';

/**
 * Review before publishing, for one client (`0060`, on by default). Optimistic:
 * the switch moves at once and goes back if the request fails. A plan already
 * waiting stays waiting whichever way it is flipped — the server says so, and
 * the page is read again to show it.
 */
export function CareReviewSwitch({ enabled, linkId }: Readonly<{ enabled: boolean; linkId: string }>) {
  const router = useRouter();
  const dictionary = useDictionary();
  const t = dictionary.practice;
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string>();

  async function flip(next: boolean) {
    setChecked(next);
    setError(undefined);

    try {
      const link = await api<CareClientLinkView>(`/care/clients/${encodeURIComponent(linkId)}`, {
        body: { reviewBeforePublish: next },
        method: 'PATCH'
      });

      setChecked(link.reviewBeforePublish);
      router.refresh();
    } catch (caught) {
      setChecked(!next);
      setError(caught instanceof ApiError && caught.code === 'NOT_FOUND' ? t.gone : messageFor(caught, dictionary));
    }
  }

  return (
    <SettingSwitch
      checked={checked}
      error={error}
      hint={checked ? t.reviewOnHint : t.reviewOffHint}
      label={t.reviewLabel}
      onCheckedChange={next => void flip(next)}
    />
  );
}
