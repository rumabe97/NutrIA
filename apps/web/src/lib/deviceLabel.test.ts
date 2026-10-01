import { describe, expect, it } from 'vitest';

import { deviceLabel, readDevice } from './deviceLabel';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';

const AGENTS = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  iphoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/129.0.2792.84 Mobile/15E148 Safari/605.1.15',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  linuxChrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'
};

describe('readDevice', () => {
  it.each([
    ['iphoneSafari', 'safari', 'iphone'],
    ['iphoneChrome', 'chrome', 'iphone'],
    ['iphoneFirefox', 'firefox', 'iphone'],
    ['iphoneEdge', 'edge', 'iphone'],
    ['iphoneWebView', 'safari', 'iphone'],
    ['ipadSafari', 'safari', 'ipad'],
    ['androidChrome', 'chrome', 'android'],
    ['androidFirefox', 'firefox', 'android'],
    ['macSafari', 'safari', 'mac'],
    ['macChrome', 'chrome', 'mac'],
    ['windowsChrome', 'chrome', 'windows'],
    ['windowsEdge', 'edge', 'windows'],
    ['windowsFirefox', 'firefox', 'windows'],
    ['linuxChrome', 'chrome', 'linux'],
    ['linuxFirefox', 'firefox', 'linux']
  ] as const)('reads %s as %s on %s', (agent, browser, platform) => {
    expect(readDevice(AGENTS[agent])).toEqual({ browser, platform });
  });

  it('reads nothing from an empty or missing agent', () => {
    expect(readDevice('')).toEqual({ browser: null, platform: null });
    expect(readDevice(null)).toEqual({ browser: null, platform: null });
    expect(readDevice(undefined)).toEqual({ browser: null, platform: null });
  });

  it('does not take a command-line client for a browser', () => {
    expect(readDevice('curl/8.5.0')).toEqual({ browser: null, platform: null });
  });
});

describe('deviceLabel', () => {
  it('names the browser and the device, in each language', () => {
    expect(deviceLabel(AGENTS.iphoneSafari, esES)).toBe('Safari en iPhone');
    expect(deviceLabel(AGENTS.windowsEdge, enGB)).toBe('Edge on Windows');
  });

  it('falls back to the generic name for a browser it cannot read', () => {
    expect(deviceLabel('curl/8.5.0', esES)).toBe('Navegador');
    expect(deviceLabel(null, enGB)).toBe('Browser');
  });

  it('still names the device when only the browser is unknown', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) SomeBrowser/1.0', esES)).toBe('Navegador en Windows');
  });
});
