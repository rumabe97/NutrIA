import { describe, expect, it } from 'vitest';

import { deviceOf } from './Device';

const AGENTS = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  ipadSafari: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  samsung: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'
};

describe('deviceOf', () => {
  it.each([
    [AGENTS.iphoneSafari, 'safari', 'iphone'],
    [AGENTS.iphoneChrome, 'chrome', 'iphone'],
    [AGENTS.ipadSafari, 'safari', 'ipad'],
    [AGENTS.macSafari, 'safari', 'mac'],
    [AGENTS.windowsEdge, 'edge', 'windows'],
    [AGENTS.androidChrome, 'chrome', 'android'],
    [AGENTS.samsung, 'samsung', 'android'],
    [AGENTS.linuxFirefox, 'firefox', 'linux'],
    [AGENTS.chromebook, 'chrome', 'chromeos']
  ])('reads %s as a browser family and a system family', (agent, browser, system) => {
    expect(deviceOf(agent)).toEqual({ browser, system });
  });

  it('answers nothing for an absent or unknown agent', () => {
    expect(deviceOf(null)).toEqual({ browser: null, system: null });
    expect(deviceOf(undefined)).toEqual({ browser: null, system: null });
    expect(deviceOf('')).toEqual({ browser: null, system: null });
    expect(deviceOf('curl/8.4.0')).toEqual({ browser: null, system: null });
  });

  it('keeps nothing finer than the two families — no version, no model', () => {
    expect(Object.keys(deviceOf(AGENTS.samsung)).sort()).toEqual(['browser', 'system']);
  });
});
