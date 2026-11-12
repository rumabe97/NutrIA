import { renderToStaticMarkup } from 'react-dom/server';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';
import { esES } from 'i18n/dictionaries/es-ES';

import { AssistantWarning } from './AssistantWarning';

const PRIVACY = '/privacidad#asistente';

function render(t: typeof esES.assistant, folded: boolean, expanded = false): string {
  return renderToStaticMarkup(
    <ul>
      <AssistantWarning expanded={expanded} folded={folded} fullId="warning-full" onToggle={() => undefined} privacyHref={PRIVACY} t={t} />
    </ul>
  );
}

/** The text a reader would get from the markup: tags out, entities back. */
function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** The paragraph holding the full text, with its `hidden` attribute if any. */
function fullParagraph(markup: string): string {
  return markup.match(/<p[^>]*id="warning-full"[^>]*>.*?<\/p>/)?.[0] ?? '';
}

describe.each([
  ['es-ES', esES.assistant],
  ['en-GB', enGB.assistant]
])('AssistantWarning (%s)', (_, t) => {
  const whole = t.warning.replace('{privacy}', t.warningPrivacy);

  it('is whole, link and all, while the conversation has no message (FULL)', () => {
    const markup = render(t, false);

    expect(text(fullParagraph(markup))).toBe(whole);
    expect(fullParagraph(markup)).not.toContain('hidden');
    expect(markup).toContain(`href="${PRIVACY}"`);
    expect(markup).not.toContain(t.warningShort);
    expect(markup).not.toContain('<button');
    expect(markup).toContain(t.warningLabel);
  });

  it('folds to its AI and health sentence and a closed «Aviso completo» once there is a message (FOLDED)', () => {
    const markup = render(t, true);

    expect(markup).toContain(t.warningShort);
    expect(markup).toMatch(new RegExp(`<button[^>]*aria-controls="warning-full"[^>]*aria-expanded="false"[^>]*type="button"[^>]*>${t.warningMore}`));
    // The full text is in the page for `aria-controls`, but hidden.
    expect(fullParagraph(markup)).toMatch(/hidden=""/);
    expect(markup).toContain(t.warningLabel);
    expect(markup).not.toContain('role="status"');
  });

  it('shows every word again, right after the button, once pressed (EXPANDED)', () => {
    const markup = render(t, true, true);

    expect(markup).toMatch(/aria-expanded="true"/);
    expect(fullParagraph(markup)).not.toContain('hidden');
    expect(text(fullParagraph(markup))).toBe(whole);
    expect(markup.indexOf('</button>')).toBeLessThan(markup.indexOf('id="warning-full"'));
    expect(markup).toContain(t.warningShort);
  });

  it('never clamps the folded line', () => {
    expect(render(t, true)).not.toMatch(/line-clamp|ellipsis|nowrap/);
  });
});

describe('AssistantWarning keeps nothing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes nothing to storage or a cookie in any of its states', () => {
    const touched: string[] = [];
    const store = { getItem: () => touched.push('get'), removeItem: () => touched.push('remove'), setItem: () => touched.push('set') };
    const documentStub = {};

    Object.defineProperty(documentStub, 'cookie', { get: () => touched.push('cookie read') && '', set: () => touched.push('cookie write') });
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('sessionStorage', store);
    vi.stubGlobal('document', documentStub);

    render(esES.assistant, false);
    render(esES.assistant, true);
    render(esES.assistant, true, true);

    expect(touched).toEqual([]);
  });
});
