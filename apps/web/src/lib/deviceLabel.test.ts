import { describe, expect, it } from 'vitest';

import { deviceLabel } from './deviceLabel';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';

const AGENTS = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  ipadSafari: 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79'
};

describe('deviceLabel', () => {
  it.each([
    ['iphoneSafari', 'Safari en iPhone', 'Safari on iPhone'],
    ['iphoneChrome', 'Chrome en iPhone', 'Chrome on iPhone'],
    ['ipadSafari', 'Safari en iPad', 'Safari on iPad'],
    ['androidChrome', 'Chrome en Android', 'Chrome on Android'],
    ['macSafari', 'Safari en Mac', 'Safari on Mac'],
    ['windowsEdge', 'Edge en Windows', 'Edge on Windows'],
    ['linuxFirefox', 'Firefox en Linux', 'Firefox on Linux']
  ] as const)('names %s in each language', (agent, spanish, english) => {
    expect(deviceLabel(AGENTS[agent], esES)).toBe(spanish);
    expect(deviceLabel(AGENTS[agent], enGB)).toBe(english);
  });

  it('falls back to the generic name when nothing can be read', () => {
    expect(deviceLabel('curl/8.5.0', esES)).toBe('Navegador');
    expect(deviceLabel('', enGB)).toBe('Browser');
    expect(deviceLabel(null, esES)).toBe('Navegador');
  });

  it('still names the device when only the browser is unknown', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) SomeBrowser/1.0', esES)).toBe('Navegador en Windows');
  });
});
