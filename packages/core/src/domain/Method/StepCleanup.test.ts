import { describe, expect, it } from 'vitest';

import { cleanStep, cleanSteps, stepChangeKinds } from 'core/domain/Method';

import type { GeneratedStep, StepCleanupOptions } from 'core/domain/Method';

const NAMES = new Map([
  ['pan-integral', 'pan integral'],
  ['queso-cottage', 'queso cottage']
]);

const ES: StepCleanupOptions = { ingredientNames: NAMES, locale: 'es-ES' };
const EN: StepCleanupOptions = { ingredientNames: NAMES, locale: 'en-GB' };

describe('cleanStep — the real failures measured on google/gemma-4-31b-it (prompt 4.2.0)', () => {
  it("turns a leaked field name after a number into the locale's own word, backticks and all", () => {
    const step: GeneratedStep = { text: 'Poner el arroz en la cazuela y cocerlo en agua con sal durante 12 `minutes` hasta que esté tierno' };

    expect(cleanStep(step, ES)).toEqual({
      minutes: 12,
      text: 'Poner el arroz en la cazuela y cocerlo en agua con sal durante 12 minutos hasta que esté tierno'
    });
  });

  it('says one minute in the singular', () => {
    const step: GeneratedStep = { text: 'Reposar la carne durante 1 `minutes` antes de servir' };

    expect(cleanStep(step, ES)?.text).toBe('Reposar la carne durante 1 minuto antes de servir');
  });

  it("reads a catalogue slug left in the prose back as the ingredient's own name, in lower case", () => {
    const step: GeneratedStep = { text: 'Tueste la rebanada de pan-integral en la tostadora dos minutos por cada lado' };

    expect(cleanStep(step, ES)?.text).toBe('Tueste la rebanada de pan integral en la tostadora dos minutos por cada lado');
  });

  it('does the same for a second slug, anywhere in the sentence', () => {
    const step: GeneratedStep = { text: 'Extienda el queso-cottage sobre la tostada y añada la miel por encima de todo' };

    expect(cleanStep(step, ES)?.text).toBe('Extienda el queso cottage sobre la tostada y añada la miel por encima de todo');
  });

  it('drops a cue that reads as English in a Spanish request, keeping the dish and its own text', () => {
    const step: GeneratedStep = { cue: 'until the rice is tender', text: 'Cuece el arroz a fuego medio, removiendo de vez en cuando' };
    const cleaned = cleanStep(step, ES);

    expect(cleaned).not.toBeNull();
    expect(cleaned?.cue).toBeUndefined();
    expect(cleaned?.text).toBe(step.text);
  });

  it('rejects a step whose own text reads as English in a Spanish request', () => {
    const step: GeneratedStep = { text: 'Sear the pork for four minutes until it is golden on both sides' };

    expect(cleanStep(step, ES)).toBeNull();
  });

  it('rejects the whole dish through cleanSteps the moment one step reads as English', () => {
    const steps: readonly GeneratedStep[] = [
      { text: 'Cuece el arroz a fuego medio, removiendo de vez en cuando' },
      { text: 'Sear the pork for four minutes until it is golden on both sides' }
    ];

    expect(cleanSteps(steps, ES)).toBeNull();
  });
});

describe('cleanStep — negatives: what must never change', () => {
  it('leaves a step DeepSeek already wrote clean untouched, byte for byte', () => {
    const step: GeneratedStep = {
      cue: 'hasta que el arroz esté en su punto',
      minutes: 12,
      text: 'Cuece el arroz en agua con sal durante 12 minutos, removiendo de vez en cuando'
    };

    expect(cleanStep(step, ES)).toEqual(step);
  });

  it('leaves a hyphenated word that is not a catalogue slug alone', () => {
    const step: GeneratedStep = { text: 'Baja el fuego a temperatura medio-alto y tapa la sartén' };

    expect(cleanStep(step, ES)?.text).toBe(step.text);
  });

  it("never guesses which of two stated durations is the step's own", () => {
    const step: GeneratedStep = { text: 'Hornea 10 minutos por un lado y después 5 minutos más por el otro' };

    expect(cleanStep(step, ES)?.minutes).toBeUndefined();
  });

  it('leaves an existing minutes field alone even when the text also states a duration', () => {
    const step: GeneratedStep = { minutes: 7, text: 'Saltea las verduras 3 minutos a fuego fuerte' };

    expect(cleanStep(step, ES)?.minutes).toBe(7);
  });

  it('never applies the language gate to a request already asked for in English', () => {
    const step: GeneratedStep = { cue: 'until the edges brown', text: 'Sear the pork for four minutes until it is golden on both sides' };
    const cleaned = cleanStep(step, EN);

    expect(cleaned).not.toBeNull();
    expect(cleaned?.cue).toBe('until the edges brown');
    expect(cleaned?.text).toBe(step.text);
  });
});

describe('cleanStep — deriving a missing minutes field', () => {
  it('sets it from the one duration the text states', () => {
    const step: GeneratedStep = { text: 'Deja reposar la masa 1 hora antes de hornear' };

    expect(cleanStep(step, ES)?.minutes).toBe(60);
  });

  it('leaves it unset when the text states none', () => {
    const step: GeneratedStep = { text: 'Emplata el pescado junto a la ensalada y sirve de inmediato' };

    expect(cleanStep(step, ES)?.minutes).toBeUndefined();
  });
});

describe('cleanStep — a cue written into the text (google/gemma-4-31b-it rewriting stored recipes)', () => {
  it('takes "cue:" to the end of the text out and makes it the cue, with the one duration left in the field', () => {
    const step = {
      text: 'Lava la patata y ponla en una olla con agua y la sal. Cocina a fuego medio-alto durante 15 minutos hasta que esté tierna al pincharla con un cuchillo. cue: que el cuchillo entre y salga sin resistencia.'
    };

    expect(cleanStep(step, ES)).toEqual({
      cue: 'que el cuchillo entre y salga sin resistencia',
      minutes: 15,
      text: 'Lava la patata y ponla en una olla con agua y la sal. Cocina a fuego medio-alto durante 15 minutos hasta que esté tierna al pincharla con un cuchillo.'
    });
  });

  it('keeps the cue the step already had', () => {
    expect(cleanStep({ cue: 'hasta que dore', text: 'Dora el pan integral 3 minutos. cue: que cruja' }, ES)).toEqual({
      cue: 'hasta que dore',
      minutes: 3,
      text: 'Dora el pan integral 3 minutos.'
    });
  });

  it('leaves a text with no such label exactly as it was', () => {
    const step = { cue: 'hasta que dore', minutes: 3, text: 'Dora el pan integral a fuego medio-alto.' };

    expect(cleanStep(step, ES)).toEqual(step);
  });
});

describe('stepChangeKinds — what a report counts, agreeing with cleanStep on every input', () => {
  it('names the backtick and the placeholder word on the same leaked field name', () => {
    const step: GeneratedStep = { text: 'Cocer 12 `minutes` hasta que esté tierno' };

    expect(stepChangeKinds(step, ES)).toEqual(expect.arrayContaining(['backtick', 'placeholderWord']));
  });

  it('names the placeholder word, and minutesFilled since the field was unset and the fixed text states one duration', () => {
    const step: GeneratedStep = { text: 'Cocer 12 minutes hasta que esté tierno' };

    expect(stepChangeKinds(step, ES)).toEqual(expect.arrayContaining(['placeholderWord', 'minutesFilled']));
    expect(stepChangeKinds(step, ES)).not.toContain('backtick');
  });

  it('names slugToName for a catalogue slug left in the prose', () => {
    const step: GeneratedStep = { text: 'Tueste la rebanada de pan-integral en la tostadora' };

    expect(stepChangeKinds(step, ES)).toEqual(['slugToName']);
  });

  it('names minutesFilled when the field is unset and the text states exactly one duration', () => {
    const step: GeneratedStep = { text: 'Deja reposar la masa 1 hora antes de hornear' };

    expect(stepChangeKinds(step, ES)).toEqual(['minutesFilled']);
  });

  it('names englishCueDropped for a cue that reads as English in a Spanish request', () => {
    const step: GeneratedStep = { cue: 'until the rice is tender', text: 'Cuece el arroz a fuego medio, removiendo de vez en cuando' };

    expect(stepChangeKinds(step, ES)).toEqual(['englishCueDropped']);
  });

  it('names nothing for a step already clean', () => {
    const step: GeneratedStep = {
      cue: 'hasta que el arroz esté en su punto',
      minutes: 12,
      text: 'Cuece el arroz en agua con sal durante 12 minutos, removiendo de vez en cuando'
    };

    expect(stepChangeKinds(step, ES)).toEqual([]);
  });

  it('names nothing past the text for a step whose own text reads as English — cleanStep rejects the whole step there', () => {
    const step: GeneratedStep = { cue: 'until the edges brown', text: 'Sear the pork for four minutes until it is golden on both sides' };

    expect(stepChangeKinds(step, ES)).toEqual([]);
    expect(cleanStep(step, ES)).toBeNull();
  });

  it('never applies the language gate in an English request, so an English cue is never dropped there', () => {
    const step: GeneratedStep = { cue: 'until the edges brown', text: 'Sear the pork for four minutes until it is golden on both sides' };

    expect(stepChangeKinds(step, EN)).toEqual([]);
  });
});

describe('cleanStep — a one-word slug is a plain word, and is left alone', () => {
  const WIDE: StepCleanupOptions = {
    ingredientNames: new Map([
      ['cilantro', 'cilantro fresco'],
      ['tomate', 'tomate fresco'],
      ['tomate-triturado', 'tomate triturado']
    ]),
    locale: 'es-ES'
  };

  it('does not turn "el tomate triturado" into "el tomate fresco triturado"', () => {
    expect(cleanStep({ text: 'Añade el tomate triturado y cuece a fuego medio.' }, WIDE)?.text).toBe(
      'Añade el tomate triturado y cuece a fuego medio.'
    );
  });

  it('does not write "fresco" twice', () => {
    expect(cleanStep({ text: 'Pica el cilantro fresco y repártelo por encima.' }, WIDE)?.text).toBe(
      'Pica el cilantro fresco y repártelo por encima.'
    );
  });

  it('still reads a hyphenated slug back as its name', () => {
    expect(cleanStep({ text: 'Vierte el tomate-triturado en la sartén.' }, WIDE)?.text).toBe('Vierte el tomate triturado en la sartén.');
  });
});
