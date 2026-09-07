'use client';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import styles from './LocaleSwitcher.module.css';

import { LOCALES } from 'i18n/config';
import { Text } from 'ui/components/Text';
import { useDictionary, useLocale } from 'i18n/LocaleProvider';

import { api, ApiError, messageFor } from 'lib/api';
import { writeLocaleCookie } from 'lib/locale-sync';

import type { Locale } from 'i18n/config';

/** Each language named in itself. A "Spanish" nobody who wants it can read is not an offer. */
const LOCALE_NAMES: Record<Locale, string> = { 'en-GB': 'English', 'es-ES': 'Español' };

/** The two-letter mark for the compact switcher, where a full word does not fit. */
const LOCALE_SHORT: Record<Locale, string> = { 'en-GB': 'EN', 'es-ES': 'ES' };

const NOT_FOUND = 404;

/**
 * The language control, and the one place the cookie and the profile column are
 * written together.
 *
 * The cookie is what the next render reads; `profiles.locale` is the durable
 * preference that survives a new device. The cookie is written **first**, and
 * always, because it is the half that works signed out — the landing page needs
 * this control as much as the dashboard does, and someone deciding whether to
 * sign up at all has no profile to persist to yet.
 *
 * `compact` is the header form: two marks, no heading, no hint. The full form
 * lives on the profile screen, where there is room to say what it does.
 */
export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const active = useLocale();
  const dictionary = useDictionary();
  // Which locale is being applied, not merely that something is: the progress
  // belongs on the option that was pressed.
  const [pending, setPending] = useState<Locale | null>(null);
  const [error, setError] = useState<string>();

  async function choose(locale: Locale) {
    if (locale === active || pending !== null) {return;}

    setError(undefined);
    setPending(locale);
    // Before the request, not after: the visible change must not wait on — or be
    // lost to — a call that a signed-out visitor has no business making.
    writeLocaleCookie(locale);

    try {
      await api('/profile', { body: { locale }, method: 'PATCH' });
    } catch (caught) {
      // 404 is what every protected route returns to a caller with no session
      // (the denial rule in `apps/api/AGENTS.md`). There is no profile to
      // persist to, and nothing has gone wrong. Anything else has.
      if (!(caught instanceof ApiError && caught.status === NOT_FOUND)) {
        setError(messageFor(caught, dictionary));
      }
    } finally {
      setPending(null);
      // A full refresh rather than local state: every server-rendered string on
      // the page came from the old dictionary, and half a translated screen is
      // worse than a moment's wait.
      router.refresh();
    }
  }

  const options = (
    <div aria-label={dictionary.profile.locale} className={compact ? styles.compactOptions : styles.options} role="group">
      {LOCALES.map(locale => (
        <button
          aria-busy={pending === locale || undefined}
          aria-label={compact ? LOCALE_NAMES[locale] : undefined}
          aria-pressed={locale === active}
          className={compact ? styles.compactOption : styles.option}
          disabled={pending !== null}
          key={locale}
          onClick={() => void choose(locale)}
          type="button"
        >
          {compact ? LOCALE_SHORT[locale] : LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );

  if (compact) {return options;}

  return (
    <section className={styles.panel}>
      <Text weight="semibold">{dictionary.profile.locale}</Text>
      <Text size="sm" tone="secondary">
        {dictionary.profile.localeHint}
      </Text>

      {options}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
