import { describe, expect, it } from 'vitest';

import { ASSISTANT_PROMPT_VERSION, assistantContext, assistantSystemPrompt, figureSet } from 'core/domain/Assistant';

const CONTEXT = assistantContext({
  cookingTimeMinutes: 20,
  cuisines: ['Mediterránea'],
  days: [
    {
      date: '2026-11-12',
      meals: [{ accompaniments: ['Pan'], dish: 'Lentejas', macros: { carbsG: 62, fatG: 21, fiberG: 9.4, kcal: 652, proteinG: 45 }, slot: 'lunch' }],
      targets: { carbsG: 240, fatG: 69, fiberG: 30, kcal: 2079, proteinG: 130 }
    }
  ],
  dietaryPatterns: [],
  dislikedNames: [],
  goal: 'maintenance',
  kitchen: null,
  language: 'Spanish',
  likedFoods: [],
  lovedNames: [],
  slotShares: new Map([['lunch', 0.33]]),
  targets: { carbsG: 240, fatG: 69, fiberG: 30, kcal: 2079, proteinG: 130 }
});

function data(prompt: string): unknown {
  return JSON.parse(prompt.slice(prompt.indexOf('DATA:\n') + 'DATA:\n'.length));
}

describe('assistantSystemPrompt', () => {
  it('is versioned, so a change to its words is a change somebody can see on a call', () => {
    expect(ASSISTANT_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('answers in the person’s language', () => {
    expect(assistantSystemPrompt(CONTEXT)).toContain('Answer in Spanish.');
  });

  /**
   * The property the figure check rests on: the figures the model is shown and
   * the set its answer is checked against come from one object, so they cannot
   * disagree.
   */
  it('shows the model the context exactly as built — the same object the figure set reads', () => {
    expect(data(assistantSystemPrompt(CONTEXT))).toEqual(CONTEXT);

    for (const value of Object.values(figureSet(CONTEXT, '')).flat()) {
      expect(assistantSystemPrompt(CONTEXT)).toContain(String(value));
    }
  });

  it('states each rule a screen also enforces, so a model that follows them gets its answer shown', () => {
    const prompt = assistantSystemPrompt(CONTEXT);

    expect(prompt).toContain('never say you did');
    expect(prompt).toContain('never write a plan of several days');
    expect(prompt).toContain('only a figure from DATA');
    // Told that answers are checked for allergies, and never which ones (legal F1).
    expect(prompt).toContain('allergies or intolerances you are not told about');
    expect(prompt.toLowerCase()).not.toContain('huevo');
    expect(prompt).toContain('dietitian-nutritionist or a doctor');
  });
});
