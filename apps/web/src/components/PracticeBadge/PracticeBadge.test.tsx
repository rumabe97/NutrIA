import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';
import { esES } from 'i18n/dictionaries/es-ES';
import { LocaleProvider } from 'i18n/LocaleProvider';

import { PracticeBadge } from './PracticeBadge';

import type { BadgeView } from 'core/controllers/Professional';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined }) }));

const NONE: BadgeView = {
  checkedAt: null,
  codeEntered: false,
  codeExpiresAt: null,
  decision: null,
  dueAt: null,
  lapsesAt: null,
  number: null,
  register: null,
  state: 'none'
};

function page(badge: BadgeView): string {
  return renderToStaticMarkup(
    <LocaleProvider dictionary={esES} locale="es-ES">
      <PracticeBadge badge={badge} />
    </LocaleProvider>
  )
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

const t = esES.practice;

describe('PracticeBadge — every state of the badge (textos/01 §§ P2–P3)', () => {
  it('offers the application, with its art. 13 sentence and no contact field', () => {
    const markup = page(NONE);

    expect(markup).toContain(t.badgeApplyTitle);
    expect(markup).toContain(t.badgeRegister);
    expect(markup).toContain(t.badgeNumber);
    expect(markup).toContain(t.badgeApplyPrivacy.split('{privacy}')[0]);
    expect(markup).not.toMatch(/type="email"|type="tel"/);
  });

  it('says an application is waiting, with nothing to type', () => {
    const markup = page({ ...NONE, register: 'CODINAN', state: 'applied' });

    expect(markup).toContain(t.badgeState.applied);
    expect(markup).toContain('aria-current="step"');
    expect(markup).not.toContain(t.badgeApplyCta);
    expect(markup).not.toContain(t.badgeCodeCta);
  });

  it('asks for the code while one is out, and not once it is entered', () => {
    const sent = { ...NONE, codeExpiresAt: '2026-12-01T00:00:00Z', state: 'code_sent' } as const;

    expect(page(sent)).toContain(t.badgeCodeCta);
    expect(page({ ...sent, codeEntered: true })).toContain(t.badgeCodeDone);
    expect(page({ ...sent, codeEntered: true })).not.toContain(t.badgeCodeCta);
  });

  it('draws the title and the number only from a standing badge', () => {
    const badged = page({ ...NONE, checkedAt: '2026-11-01T00:00:00Z', number: 'AND-1', register: 'CODINAN', state: 'badged' });

    expect(badged).toContain('Dietista-nutricionista colegiada/o · Comprobado por NutrIA el');
    expect(badged).toContain('AND-1');
    expect(page({ ...NONE, number: 'AND-1', register: 'CODINAN', state: 'applied' })).not.toContain('AND-1');
  });

  it('says a refusal, a withdrawal and a lapse with their reasons, and lets them apply again', () => {
    const decision = { at: '2026-11-10T00:00:00Z', facts: null, kind: 'withdrawn', reason: 'not_me' } as const;

    const withdrawn = page({ ...NONE, decision, state: 'withdrawn' });
    expect(withdrawn).toContain(t.badgeState.withdrawn);
    expect(withdrawn).toContain(t.badgeReasons.not_me);
    expect(withdrawn).toContain(t.badgeApplyCta);

    expect(page({ ...NONE, decision: { ...decision, kind: 'fail', reason: 'code_expired' }, state: 'refused' })).toContain(
      t.badgeReasons.code_expired
    );
    expect(page({ ...NONE, decision: { ...decision, kind: 'lapsed', reason: 'our_delay' }, state: 'lapsed' })).toContain(t.badgeReasons.our_delay);
  });
});
