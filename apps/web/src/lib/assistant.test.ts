import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { readLines, threadItems } from './assistant';

describe('the assistant’s warning (PRD 12)', () => {
  it('opens a new conversation, before anything can be typed into it', () => {
    expect(threadItems([])).toEqual([{ kind: 'warning' }]);
  });

  it('opens a reopened one too, every time, ahead of every turn', () => {
    const items = threadItems(['first question', 'its answer']);

    expect(items[0]).toEqual({ kind: 'warning' });
    expect(items.filter(item => item.kind === 'warning')).toHaveLength(1);
    expect(items.slice(1)).toEqual([
      { kind: 'turn', turn: 'first question' },
      { kind: 'turn', turn: 'its answer' }
    ]);
  });

  it('is written in both languages, and is the legal agent’s text, not a placeholder', () => {
    for (const dictionary of [esES, enGB]) {
      expect(dictionary.assistant.warning.trim().length).toBeGreaterThan(80);
      expect(dictionary.assistant.warning).not.toContain('PENDING');
    }
  });
});

describe('readLines', () => {
  it('hands over whole lines and keeps the part of one still arriving', () => {
    expect(readLines('{"type":"conversation","id":"c"}\n{"type":"te')).toEqual({ lines: ['{"type":"conversation","id":"c"}'], rest: '{"type":"te' });
  });

  it('skips blank lines, and holds everything when no line has ended', () => {
    expect(readLines('\n{"a":1}\n\n')).toEqual({ lines: ['{"a":1}'], rest: '' });
    expect(readLines('{"a"')).toEqual({ lines: [], rest: '{"a"' });
  });
});
