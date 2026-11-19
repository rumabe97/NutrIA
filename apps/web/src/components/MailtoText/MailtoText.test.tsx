import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';
import { esES } from 'i18n/dictionaries/es-ES';

import { interpolate } from 'lib/format';

import { MailtoText } from './MailtoText';

describe('MailtoText', () => {
  it('turns {email} into a mailto link and keeps every other word as written', () => {
    const text = interpolate(esES.care.illnessEndedBadgeBody, { professional: 'Ana' });
    const markup = renderToStaticMarkup(<MailtoText email="someone@example.invalid" text={text} />);

    expect(markup).toContain('href="mailto:someone@example.invalid"');
    expect(markup.replace(/<[^>]+>/g, '')).toBe(text.replace('{email}', 'someone@example.invalid'));
  });

  it('draws a sentence without the placeholder untouched', () => {
    expect(renderToStaticMarkup(<MailtoText email="someone@example.invalid" text="Sin correo." />)).toBe('Sin correo.');
  });
});
