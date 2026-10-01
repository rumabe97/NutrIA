import { DEVICE_BROWSER_NAMES, DEVICE_SYSTEM_NAMES, deviceOf } from 'core/domain/Device';

import { interpolate } from './format';

import type { Dictionary } from '../i18n/dictionaries/es-ES';

/**
 * A session's device in words — "Safari en iPhone", "Chrome on Windows" — for the session
 * list in /perfil. The reading is `core`'s `deviceOf`, the one the "password changed" mail
 * uses, so the list and the mail name the same session the same way; only the joining
 * words are this app's. The generic name stands in for a browser it cannot read, so a row
 * is never empty.
 */
export function deviceLabel(userAgent: string | null | undefined, dictionary: Dictionary): string {
  const t = dictionary.security;
  const { browser, system } = deviceOf(userAgent);
  const browserName = browser ? DEVICE_BROWSER_NAMES[browser] : t.browserUnknown;

  return system ? interpolate(t.deviceOn, { browser: browserName, platform: DEVICE_SYSTEM_NAMES[system] }) : browserName;
}
