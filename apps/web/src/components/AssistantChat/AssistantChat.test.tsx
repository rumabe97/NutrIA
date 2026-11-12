import { renderToStaticMarkup } from 'react-dom/server';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';
import { esES } from 'i18n/dictionaries/es-ES';
import { LocaleProvider } from 'i18n/LocaleProvider';

import { AssistantWarning } from 'components/AssistantWarning';

import { warningOpenedAfter, warningState } from 'lib/assistantWarning';

import { AssistantChat } from './AssistantChat';

import type { AssistantStanding, AssistantTurn } from 'lib/assistant';
import type { Locale } from 'i18n/config';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined }) }));

const STANDING: AssistantStanding = { allowed: true, labelling: false, limit: 20, remaining: 20, resetsOn: null, used: 0 };
const TURN: AssistantTurn = { id: 't1', content: '¿Qué ceno hoy?', createdAt: '2026-11-12T10:00:00.000Z', decline: null, role: 'user' };

function chat(dictionary: typeof esES, locale: Locale, turns: readonly AssistantTurn[]): string {
  return renderToStaticMarkup(
    <LocaleProvider dictionary={dictionary} locale={locale}>
      <AssistantChat conversationId={turns.length > 0 ? 'c1' : null} standing={STANDING} turns={turns} />
    </LocaleProvider>
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

/** The line under the box: the element the field's description names after the box. */
function lineUnderTheBox(markup: string): string {
  const after = markup.slice(markup.indexOf('<textarea'));

  return text(after);
}

/**
 * The page's own state machine for the warning, run as React runs it: `opened` changes only on
 * the button, and the count of messages adjusts it while rendering (`AssistantChat`).
 */
function visit() {
  let opened = false;
  let messages = 0;

  return {
    press() {
      opened = !opened;
    },
    setMessages(count: number) {
      messages = count;
      opened = warningOpenedAfter(opened, count);
    },
    get state() {
      return warningState(messages, opened);
    }
  };
}

describe.each([
  ['es-ES', esES, 'es-ES' as Locale],
  ['en-GB', enGB, 'en-GB' as Locale]
])('AssistantChat and its warning (%s)', (_, dictionary, locale) => {
  const t = dictionary.assistant;
  const whole = t.warning.replace('{privacy}', t.warningPrivacy);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('says composerNotice under the box with no message, and the warning is whole (FULL)', () => {
    const markup = chat(dictionary, locale, []);

    expect(lineUnderTheBox(markup)).toContain(t.composerNotice);
    expect(text(markup)).toContain(whole);
    expect(markup).not.toContain('aria-expanded');
  });

  it('says composerNotice under the box with one message, and the warning is folded behind its button', () => {
    const markup = chat(dictionary, locale, [TURN]);

    expect(lineUnderTheBox(markup)).toContain(t.composerNotice);
    expect(text(markup)).toContain(t.warningShort);
    expect(markup).toMatch(/<button[^>]*aria-expanded="false"[^>]*>/);
    expect(markup).toMatch(/<p[^>]*hidden=""[^>]*>/);
  });

  it('shows the whole text with aria-expanded true once the button is pressed', () => {
    const page = visit();

    page.setMessages(1);
    expect(page.state).toBe('folded');
    page.press();
    expect(page.state).toBe('expanded');

    // What the chat then draws for that state.
    const markup = renderToStaticMarkup(
      <ul>
        <AssistantWarning
          expanded={page.state === 'expanded'}
          folded={true}
          fullId="w"
          onToggle={() => undefined}
          privacyHref="/privacidad#asistente"
          t={t}
        />
      </ul>
    );

    expect(markup).toMatch(/<button[^>]*aria-expanded="true"[^>]*>/);
    expect(markup).not.toMatch(/<p[^>]*id="w"[^>]*hidden/);
    expect(text(markup)).toContain(whole);
  });

  it('writes nothing to either storage when the chat is drawn or the button is pressed', () => {
    const write = vi.fn();
    const store = { clear: write, getItem: vi.fn(() => null), key: vi.fn(() => null), length: 0, removeItem: write, setItem: write };

    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('sessionStorage', store);

    chat(dictionary, locale, []);
    chat(dictionary, locale, [TURN]);

    const page = visit();

    page.setMessages(1);
    page.press();
    page.press();

    expect(write).not.toHaveBeenCalled();
    expect(store.getItem).not.toHaveBeenCalled();
  });

  it('folds again — never expanded — when every message is deleted and a new one is sent', () => {
    const page = visit();

    page.setMessages(2);
    page.press();
    expect(page.state).toBe('expanded');

    page.setMessages(0);
    expect(page.state).toBe('full');

    page.setMessages(1);
    expect(page.state).toBe('folded');
  });
});
