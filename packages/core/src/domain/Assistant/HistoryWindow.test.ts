import { describe, expect, it } from 'vitest';

import { HISTORY_LIMITS, historyWindow } from 'core/domain/Assistant';

import type { StoredTurn } from 'core/domain/Assistant';

function ask(text: string, replay = true): StoredTurn {
  return { replay, role: 'user', text };
}

function answer(text: string, replay = true): StoredTurn {
  return { replay, role: 'assistant', text };
}

describe('historyWindow', () => {
  it('replays whole exchanges, oldest first', () => {
    expect(historyWindow([ask('¿Y el jueves?'), answer('Lentejas.'), ask('¿Y el viernes?'), answer('Merluza.')])).toEqual([
      { role: 'user', text: '¿Y el jueves?' },
      { role: 'assistant', text: 'Lentejas.' },
      { role: 'user', text: '¿Y el viernes?' },
      { role: 'assistant', text: 'Merluza.' }
    ]);
  });

  /** Replaying a cut question would put back in front of the model exactly what a screen took out. */
  it('never replays a question that was cut, nor the decline that answered it', () => {
    expect(historyWindow([ask('¿Qué tiempo hace?', false), answer('off_topic', false), ask('¿Y el jueves?'), answer('Lentejas.')])).toHaveLength(2);
    expect(historyWindow([ask('Dame una receta'), answer('…', false)])).toEqual([]);
  });

  it('never replays half an exchange: an unanswered question, or an answer with no question', () => {
    expect(historyWindow([answer('Hola.'), ask('¿Y el jueves?'), ask('¿Me oyes?'), answer('Sí.')])).toEqual([
      { role: 'user', text: '¿Me oyes?' },
      { role: 'assistant', text: 'Sí.' }
    ]);
  });

  it('keeps the newest exchanges when there are more turns than it may replay', () => {
    const turns = Array.from({ length: 5 }, (_, index) => [ask(`p${String(index)}`), answer(`r${String(index)}`)]).flat();

    expect(historyWindow(turns, { maxCharacters: 1000, maxTurns: 4 }).map(turn => turn.text)).toEqual(['p3', 'r3', 'p4', 'r4']);
  });

  /** One long recipe costs what ten short questions do; and a hole in a conversation is worse than its end. */
  it('stops at the first exchange that does not fit, instead of skipping it for an older one', () => {
    const turns = [ask('corta'), answer('corta'), ask('larga'), answer('x'.repeat(500)), ask('última'), answer('ok')];

    expect(historyWindow(turns, { maxCharacters: 100, maxTurns: 12 }).map(turn => turn.text)).toEqual(['última', 'ok']);
  });

  it('defaults to six exchanges and eight thousand characters', () => {
    expect(HISTORY_LIMITS).toEqual({ maxCharacters: 8000, maxTurns: 12 });
    expect(historyWindow(Array.from({ length: 10 }, () => [ask('p'), answer('r')]).flat())).toHaveLength(12);
  });
});
