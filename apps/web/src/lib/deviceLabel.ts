import { interpolate } from './format';

import type { Dictionary } from '../i18n/dictionaries/es-ES';

export type DeviceBrowser = 'chrome' | 'edge' | 'firefox' | 'safari';

export type DevicePlatform = 'android' | 'ipad' | 'iphone' | 'linux' | 'mac' | 'windows';

/** What a session's user agent says about the device, as far as a person would name it. */
export interface DeviceReading {
  browser: DeviceBrowser | null;
  platform: DevicePlatform | null;
}

/**
 * Reads the browser and the kind of device out of a user agent, for the session list in
 * /perfil. Only what a person recognises their own device by: no version, no model, nothing
 * that would make the list a fingerprint.
 *
 * Order matters in both halves, because user agents borrow each other's words: Edge and
 * every iOS browser say "Safari", Chrome on iOS says "CriOS", Android says "Linux", and an
 * iPad in desktop mode says "Macintosh". An iPad that claims to be a Mac is named a Mac —
 * the string carries nothing else to tell them apart.
 */
export function readDevice(userAgent: string | null | undefined): DeviceReading {
  const agent = userAgent ?? '';

  return { browser: readBrowser(agent), platform: readPlatform(agent) };
}

function readBrowser(agent: string): DeviceBrowser | null {
  if (/\bEdg(e|A|iOS)?\//.test(agent)) {
    return 'edge';
  }

  if (/\b(Firefox|FxiOS)\//.test(agent)) {
    return 'firefox';
  }

  if (/\b(Chrome|CriOS|Chromium)\//.test(agent)) {
    return 'chrome';
  }

  if (/\bSafari\//.test(agent) && /\bVersion\//.test(agent)) {
    return 'safari';
  }

  // An app's own web view on iOS (a mail client opening a link) leaves "Safari" out; it is
  // still Safari's engine, and the person reads it as Safari.
  return /\b(iPhone|iPad)\b/.test(agent) && /AppleWebKit\//.test(agent) ? 'safari' : null;
}

function readPlatform(agent: string): DevicePlatform | null {
  if (/\biPad\b/.test(agent)) {
    return 'ipad';
  }

  if (/\b(iPhone|iPod)\b/.test(agent)) {
    return 'iphone';
  }

  if (/\bAndroid\b/.test(agent)) {
    return 'android';
  }

  if (/\bWindows\b/.test(agent)) {
    return 'windows';
  }

  if (/\bMac OS X\b|\bMacintosh\b/.test(agent)) {
    return 'mac';
  }

  return /\b(Linux|X11|CrOS)\b/.test(agent) ? 'linux' : null;
}

/**
 * The device in words — "Safari en iPhone", "Chrome on Windows" — or the generic name when
 * the browser cannot be read, so a row is never empty.
 */
export function deviceLabel(userAgent: string | null | undefined, dictionary: Dictionary): string {
  const t = dictionary.security;
  const { browser, platform } = readDevice(userAgent);
  const browserName = browser ? t.browsers[browser] : t.browserUnknown;

  return platform ? interpolate(t.deviceOn, { browser: browserName, platform: t.platforms[platform] }) : browserName;
}
