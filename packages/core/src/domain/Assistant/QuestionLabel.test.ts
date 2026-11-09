import { describe, expect, it } from 'vitest';

import { ASSISTANT_DECLINES, declineFor, LABEL_EXAMPLES, LABEL_SYSTEM_PROMPT, QUESTION_LABELS, questionLabelSchema } from 'core/domain/Assistant';

describe('questionLabelSchema', () => {
  it('takes a label and a short reason, and nothing it does not know', () => {
    expect(questionLabelSchema.safeParse({ label: 'nutrition', reason: 'a recipe' }).success).toBe(true);
    expect(questionLabelSchema.safeParse({ label: 'weather', reason: 'x' }).success).toBe(false);
    expect(questionLabelSchema.safeParse({ label: 'nutrition', reason: 'x'.repeat(241) }).success).toBe(false);
  });
});

describe('declineFor', () => {
  it('answers nutrition and cuts the rest, by a code the web app turns into words', () => {
    expect(declineFor('nutrition')).toBeNull();
    expect(declineFor('clinical')).toBe('clinical');
    expect(declineFor('off_topic')).toBe('off_topic');
  });

  it('cuts only with codes the decline list knows', () => {
    for (const label of QUESTION_LABELS) {
      const decline = declineFor(label);

      expect(decline === null || ASSISTANT_DECLINES.includes(decline)).toBe(true);
    }
  });
});

/** The fixture phase 6 runs against real models; here, only that it is a fixture worth running. */
describe('LABEL_EXAMPLES', () => {
  it('has every label, and the cases that look like one thing and are another', () => {
    expect(new Set(LABEL_EXAMPLES.map(example => example.label))).toEqual(new Set(QUESTION_LABELS));
    expect(LABEL_EXAMPLES).toContainEqual({ label: 'nutrition', question: '¿El café me rompe el ayuno?' });
    expect(LABEL_EXAMPLES).toContainEqual({ label: 'off_topic', question: '¿Qué dieta sigue un futbolista famoso?' });
  });

  it('is described to the model in the same three words the code branches on', () => {
    for (const label of QUESTION_LABELS) {
      expect(LABEL_SYSTEM_PROMPT).toContain(`"${label}"`);
    }
  });
});
