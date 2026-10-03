import { describe, expect, it } from '@jest/globals';

import { BadRequestException } from '@nestjs/common';

import { blockedOrigin, CspReportService } from './CspReport.service.js';

describe('blockedOrigin', () => {
  it('keeps the origin and drops the path and the query', () => {
    expect(blockedOrigin('https://evil.example/path?token=secret#x')).toBe('https://evil.example');
  });

  it('keeps the keyword a browser uses for non-URL sources', () => {
    expect(blockedOrigin('inline')).toBe('inline');
    expect(blockedOrigin('data:image/png;base64,AAAA')).toBe('data');
    expect(blockedOrigin(undefined)).toBe('unknown');
  });
});

describe('CspReportService.parse', () => {
  const service = new CspReportService();

  it('reads the legacy report-uri body, without the document URL', () => {
    expect(
      service.parse({
        'csp-report': {
          'blocked-uri': 'https://cdn.example/a.js?k=1',
          'document-uri': 'https://nutria.example/reset?token=abc',
          'effective-directive': 'script-src-elem'
        }
      })
    ).toEqual([{ blocked: 'https://cdn.example', directive: 'script-src-elem' }]);
  });

  it('reads the Reporting API list', () => {
    expect(service.parse([{ body: { blockedURL: 'https://x.example/y', effectiveDirective: 'img-src' }, type: 'csp-violation' }])).toEqual([
      { blocked: 'https://x.example', directive: 'img-src' }
    ]);
  });

  it('refuses anything that is not a CSP report', () => {
    expect(() => service.parse({ hello: 'world' })).toThrow(BadRequestException);
    expect(() => service.parse(null)).toThrow(BadRequestException);
  });

  it('never lets free text into the directive', () => {
    const [violation] = service.parse({ 'csp-report': { 'effective-directive': 'a@b.c injected' } });

    expect(violation?.directive).toBe('unknown');
  });
});
