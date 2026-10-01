/**
 * The device a session or a mail is about, read roughly from a user agent
 * (PLAN 011 phase 2): a browser family and a system family, each a closed
 * word, or null when the string says nothing we recognise. Never a version,
 * a model number or anything finer — the session list and the "password
 * changed" mail only need "Safari on an iPhone", and a finer reading is a
 * fingerprint.
 *
 * Shared by the API (the mail) and the web app (the session list), so both
 * say the same thing about the same session.
 */
export const DEVICE_BROWSERS = ['edge', 'samsung', 'firefox', 'chrome', 'safari'] as const;
export const DEVICE_SYSTEMS = ['iphone', 'ipad', 'android', 'chromeos', 'windows', 'mac', 'linux'] as const;

export type DeviceBrowser = (typeof DEVICE_BROWSERS)[number];
export type DeviceSystem = (typeof DEVICE_SYSTEMS)[number];
export type Device = { readonly browser: DeviceBrowser | null; readonly system: DeviceSystem | null };

/** Proper names, the same in every language. */
export const DEVICE_BROWSER_NAMES: Readonly<Record<DeviceBrowser, string>> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
  samsung: 'Samsung Internet'
};

export const DEVICE_SYSTEM_NAMES: Readonly<Record<DeviceSystem, string>> = {
  android: 'Android',
  chromeos: 'ChromeOS',
  ipad: 'iPad',
  iphone: 'iPhone',
  linux: 'Linux',
  mac: 'Mac',
  windows: 'Windows'
};

/*
 * Order matters in both lists: every Chromium browser also says "Chrome" and
 * "Safari", and Chrome on iOS says "Safari" too, so the specific tokens are
 * tried first. An iPad on iPadOS 13+ claims to be a Mac; that is what it says,
 * and what it says is all this reads.
 */
const BROWSER_TOKENS: readonly (readonly [DeviceBrowser, RegExp])[] = [
  ['edge', /\bEdg(e|A|iOS)?\//],
  ['samsung', /\bSamsungBrowser\//],
  ['firefox', /\b(Firefox|FxiOS)\//],
  ['chrome', /\b(Chrome|CriOS)\//],
  ['safari', /\bSafari\//]
];

const SYSTEM_TOKENS: readonly (readonly [DeviceSystem, RegExp])[] = [
  ['iphone', /\biPhone\b/],
  ['ipad', /\biPad\b/],
  ['android', /\bAndroid\b/],
  ['chromeos', /\bCrOS\b/],
  ['windows', /\bWindows\b/],
  ['mac', /\bMacintosh\b/],
  ['linux', /\bLinux\b/]
];

function first<T extends string>(tokens: readonly (readonly [T, RegExp])[], userAgent: string): T | null {
  return tokens.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}

export function deviceOf(userAgent: string | null | undefined): Device {
  if (!userAgent) {
    return { browser: null, system: null };
  }

  return { browser: first(BROWSER_TOKENS, userAgent), system: first(SYSTEM_TOKENS, userAgent) };
}
