import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { RecipeController } from 'core/controllers/Recipe';

import { buildRewritePrompt, REWRITE_SYSTEM_PROMPT } from '../prompts/RewritePrompt.js';
import { STEPS_VERSION } from '../prompts/PoolPrompt.js';
import { RecipeRewriter, REWRITE_LIMITS } from './RecipeRewriter.service.js';
import { AiClient } from '../clients/AiClient.js';

import type { AiRequest, AiResponse } from '../clients/AiClient.js';
import type { Env } from '../../../config/index.js';
import type { UndocumentedRecipe } from 'core/controllers/Recipe';

const ON = { AI_REWRITE_STEPS: true } as Env;
const OFF = { AI_REWRITE_STEPS: false } as Env;

const RECIPE: UndocumentedRecipe = {
  id: '11111111-1111-4111-8111-111111111111',
  cookMinutes: 20,
  ingredients: [
    { grams: 300, name: 'Arroz integral' },
    { grams: 160, name: 'Lomo de cerdo' }
  ],
  locale: 'es-ES',
  name: 'Arroz integral salteado con lomo de cerdo',
  prepMinutes: 10,
  servings: 1,
  steps: [{ text: 'Saltear el lomo y añadir el arroz, mezclando tres minutos antes de servir.' }]
};

/** Every step uses only what the dish has: the pork and the rice, and nothing else. */
const GOOD = {
  steps: [
    { cue: 'hasta que doren por fuera', minutes: 3, text: 'Cortar el lomo de cerdo en tiras finas y dorarlo en una sartén amplia a fuego vivo' },
    { cue: 'hasta que no quede rosado en el centro', minutes: 4, text: 'Bajar a fuego medio y dejar que el lomo termine de hacerse, removiendo' },
    { cue: '', minutes: 3, text: 'Añadir el arroz integral y remover para que se impregne del fondo de la sartén' },
    { cue: 'hasta que esté bien caliente', minutes: 2, text: 'Saltear todo junto un par de minutos más y servir en plato hondo' }
  ]
};

/** The catalogue a rewrite is read against: the dish's two foods, and others it must not name. */
const VOCABULARY = ['Arroz', 'Arroz integral', 'Lomo de cerdo', 'Champiñones', 'Sal', 'Sésamo', 'Agua'];

class ScriptedAi extends AiClient {
  public prompts: string[] = [];

  constructor(private readonly objects: readonly unknown[]) {
    super();
  }

  get isAvailable(): boolean {
    return true;
  }

  generate<T>(request: AiRequest<T>): Promise<AiResponse<T>> {
    this.prompts.push(request.prompt);

    return Promise.resolve({
      object: (this.objects[this.prompts.length - 1] ?? this.objects[0]) as T,
      usage: { calls: 1, inputTokens: 0, model: 'scripted', outputTokens: 0 }
    });
  }
}

class UnavailableAi extends AiClient {
  get isAvailable(): boolean {
    return false;
  }

  generate<T>(): Promise<AiResponse<T>> {
    return Promise.reject(new Error('should not be called'));
  }
}

describe('RecipeRewriter', () => {
  beforeEach(() => {
    jest.spyOn(RecipeController, 'methodVocabulary').mockResolvedValue(VOCABULARY);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** The case the read-back exists for: the list was checked against somebody's allergies, the prose was not. */
  it('refuses a rewrite that names a food the dish does not contain, and stores nothing', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const seeded = {
      steps: [...GOOD.steps.slice(0, 3), { ...GOOD.steps[3], text: 'Saltear un par de minutos más y servir espolvoreado con sésamo' }]
    };

    const run = await new RecipeRewriter(new ScriptedAi([seeded]), ON).rewriteOutdated(10);

    expect(run).toEqual({ pending: 1, rewritten: 0, skipped: 1, unreached: 0 });
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('refuses a rewrite that never says where one of the dish’s ingredients goes', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const noRice = {
      steps: [GOOD.steps[0], GOOD.steps[1], { ...GOOD.steps[2], text: 'Remover para que todo se impregne del fondo de la sartén' }, GOOD.steps[3]]
    };

    const run = await new RecipeRewriter(new ScriptedAi([noRice]), ON).rewriteOutdated(10);

    expect(run.rewritten).toBe(0);
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('allows water, which a technique adds and no list carries', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const withWater = {
      steps: [...GOOD.steps.slice(0, 3), { ...GOOD.steps[3], text: 'Añadir un chorrito de agua, saltear un par de minutos y servir' }]
    };

    const run = await new RecipeRewriter(new ScriptedAi([withWater]), ON).rewriteOutdated(10);

    expect(run.rewritten).toBe(1);
    expect(rewrite).toHaveBeenCalled();
  });

  it('reads the catalogue once per language, however many recipes it rewrites', async () => {
    const vocabulary = jest.spyOn(RecipeController, 'methodVocabulary').mockResolvedValue(VOCABULARY);

    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE, { ...RECIPE, id: '22222222-2222-4222-8222-222222222222' }]);
    jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    await new RecipeRewriter(new ScriptedAi([GOOD]), ON).rewriteOutdated(10);

    expect(vocabulary).toHaveBeenCalledTimes(1);
    expect(vocabulary).toHaveBeenCalledWith('es-ES');
  });

  /** A real rewrite closed a cottage-cheese cup with a step certifying its own instructions. */
  it('refuses a rewrite with a step about its brief instead of the dish', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const certified = { steps: [...GOOD.steps, { text: 'Todos los ingredientes listados aparecen en los pasos, sin alimentos adicionales.' }] };

    const run = await new RecipeRewriter(new ScriptedAi([certified]), ON).rewriteOutdated(10);

    expect(run.rewritten).toBe(0);
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('stores an ingredient’s name without the catalogue’s capital inside a sentence', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const capitals = {
      steps: [
        { ...GOOD.steps[0], text: 'Cortar el Lomo de cerdo en tiras finas y dorarlo en una sartén amplia a fuego vivo' },
        ...GOOD.steps.slice(1)
      ]
    };

    await new RecipeRewriter(new ScriptedAi([capitals]), ON).rewriteOutdated(10);

    const [, steps] = rewrite.mock.calls[0] as [string, readonly { text: string }[], string];

    expect(steps[0]?.text).toBe('Cortar el lomo de cerdo en tiras finas y dorarlo en una sartén amplia a fuego vivo');
  });

  it('does nothing while the owner has not switched it on, however able the provider is', async () => {
    const pending = jest.spyOn(RecipeController, 'pendingStepUpgrades');

    expect(await new RecipeRewriter(new ScriptedAi([GOOD]), OFF).rewriteOutdated(10)).toEqual({ pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    expect(pending).not.toHaveBeenCalled();
  });

  it('does nothing when no provider is configured', async () => {
    const pending = jest.spyOn(RecipeController, 'pendingStepUpgrades');

    expect(await new RecipeRewriter(new UnavailableAi(), ON).rewriteOutdated(10)).toEqual({ pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    expect(pending).not.toHaveBeenCalled();
  });

  it('asks only for recipes an older prompt wrote, and stamps the new one', async () => {
    const pending = jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    const run = await new RecipeRewriter(new ScriptedAi([GOOD]), ON).rewriteOutdated(10);

    expect(pending).toHaveBeenCalledWith(STEPS_VERSION, 10);
    expect(run).toEqual({ pending: 1, rewritten: 1, skipped: 0, unreached: 0 });

    const [recipeId, steps, version] = rewrite.mock.calls[0] as [string, readonly { cue?: string; minutes?: number; text: string }[], string];

    expect(recipeId).toBe(RECIPE.id);
    expect(version).toBe(STEPS_VERSION);
    expect(steps).toHaveLength(4);
    expect(steps[0]?.cue).toBe('hasta que doren por fuera');
    // An empty cue on the wire leaves as none, not as an empty string.
    expect(steps[2]?.cue).toBeUndefined();
  });

  it('refuses a rewrite that is still too compressed, and leaves the recipe for next time', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    // Three steps for a twenty-minute cook is exactly what this exists to replace.
    const run = await new RecipeRewriter(new ScriptedAi([{ steps: GOOD.steps.slice(0, 3) }]), ON).rewriteOutdated(10);

    expect(run).toEqual({ pending: 1, rewritten: 0, skipped: 1, unreached: 0 });
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('refuses a bare action, whatever else it returns', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    const run = await new RecipeRewriter(
      new ScriptedAi([{ steps: [{ text: 'Cocer.' }, { text: 'Servir.' }, { text: 'Comer.' }, { text: 'Fin.' }] }]),
      ON
    ).rewriteOutdated(10);

    expect(run.rewritten).toBe(0);
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('stops the sweep the moment the provider says it is out of budget', async () => {
    jest
      .spyOn(RecipeController, 'pendingStepUpgrades')
      .mockResolvedValue([
        RECIPE,
        { ...RECIPE, id: '22222222-2222-4222-8222-222222222222' },
        { ...RECIPE, id: '33333333-3333-4333-8333-333333333333' }
      ]);
    jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const ai = new (class extends AiClient {
      public calls = 0;
      get isAvailable(): boolean {
        return true;
      }
      generate<T>(): Promise<AiResponse<T>> {
        this.calls += 1;

        return Promise.reject(new Error('You exceeded your current quota, please check your plan and billing details.'));
      }
    })();

    const run = await new RecipeRewriter(ai, ON).rewriteOutdated(10);

    // One attempt, not three: the other two would have spent the allowance
    // plan generation needs on calls that could not have succeeded. The first
    // call runs alone for exactly this, before any lane opens.
    expect(ai.calls).toBe(1);
    expect(run).toEqual({ pending: 3, rewritten: 0, skipped: 1, unreached: 2 });
  });

  it('counts one failure and carries on with the rest', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE, { ...RECIPE, id: '22222222-2222-4222-8222-222222222222' }]);
    jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    const run = await new RecipeRewriter(new ScriptedAi([{ steps: [] }, GOOD]), ON).rewriteOutdated(10);

    expect(run).toEqual({ pending: 2, rewritten: 1, skipped: 1, unreached: 0 });
  });
});

/**
 * A sweep is one invocation of the 300-second function. Ten rewrites in a row,
 * as it used to run them, took longer than that through the gateway — so time
 * is now part of the sweep, measured in milliseconds here.
 */
describe('RecipeRewriter — inside the function’s time', () => {
  beforeEach(() => {
    jest.spyOn(RecipeController, 'methodVocabulary').mockResolvedValue(VOCABULARY);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function many(count: number): UndocumentedRecipe[] {
    return Array.from({ length: count }, (_none, index) => ({ ...RECIPE, id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111` }));
  }

  /** Answers after `ms`, and counts how many calls it holds at once. */
  class SlowAi extends AiClient {
    public inFlight = 0;
    public most = 0;
    public requests: AiRequest<unknown>[] = [];

    constructor(private readonly ms: number) {
      super();
    }

    get isAvailable(): boolean {
      return true;
    }

    async generate<T>(request: AiRequest<T>): Promise<AiResponse<T>> {
      this.requests.push(request as AiRequest<unknown>);
      this.inFlight += 1;
      this.most = Math.max(this.most, this.inFlight);
      await new Promise(resolve => {
        setTimeout(resolve, this.ms);
      });
      this.inFlight -= 1;

      return { object: GOOD as T, usage: { calls: 1, inputTokens: 0, model: 'slow', outputTokens: 0 } };
    }
  }

  it('abandons a call that outlives the sweep, even one that ignores its signal, and writes nothing late', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue(many(3));
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const hung = new (class extends AiClient {
      get isAvailable(): boolean {
        return true;
      }

      generate<T>(): Promise<AiResponse<T>> {
        return new Promise<AiResponse<T>>(() => undefined);
      }
    })();
    const started = Date.now();

    const run = await new RecipeRewriter(hung, ON, { lanes: 2, minCallMs: 20, sweepMs: 60 }).rewriteOutdated(12);

    expect(Date.now() - started).toBeLessThan(1000);
    // The hung call is dropped at the deadline; nothing else had time to start.
    expect(run).toEqual({ pending: 3, rewritten: 0, skipped: 1, unreached: 2 });
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('keeps no more calls in flight than it has lanes, and finishes the batch when there is time', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue(many(7));
    jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const ai = new SlowAi(15);

    const run = await new RecipeRewriter(ai, ON, { lanes: 3, minCallMs: 10, sweepMs: 5000 }).rewriteOutdated(12);

    expect(run).toEqual({ pending: 7, rewritten: 7, skipped: 0, unreached: 0 });
    expect(ai.most).toBe(3);
  });

  it('starts no call it could not finish, and leaves the rest for the next sweep', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue(many(5));
    jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    // One lane, 60 ms a call, 100 ms needed to start one, 250 ms in all: calls
    // start at about 0, 60 and 120; at 180 only 70 ms are left.
    const run = await new RecipeRewriter(new SlowAi(60), ON, { lanes: 1, minCallMs: 100, sweepMs: 250 }).rewriteOutdated(12);

    expect(run).toEqual({ pending: 5, rewritten: 3, skipped: 0, unreached: 2 });
  });

  it('bounds each call by the sweep and files it under its recipe in a gateway’s log', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);
    const ai = new SlowAi(1);

    await new RecipeRewriter(ai, ON).rewriteOutdated(12);

    expect(ai.requests[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(ai.requests[0]?.session).toBe(`rewrite:${RECIPE.id}`);
  });

  /** The numbers, pinned: they are what fits the function, and loosening them is what gets a sweep killed mid-write. */
  it('holds a sweep to three lanes, ninety seconds to start a call, and 240 in all', () => {
    expect(REWRITE_LIMITS).toEqual({ lanes: 3, minCallMs: 90_000, sweepMs: 240_000 });
  });
});

describe('buildRewritePrompt', () => {
  const prompt = buildRewritePrompt(RECIPE, 'Spanish (Spain)');
  const assembled = buildRewritePrompt({ ...RECIPE, cookMinutes: 0, name: 'Copa de queso cottage con kiwi' }, 'Spanish (Spain)');

  /*
   * The first real pass gave a bowl of cottage cheese five steps, one of them a
   * minute spent spooning cheese into a cup. Documented is not the same as long.
   */
  it('scales what it asks for to how much the dish is actually cooked', () => {
    const briefly = buildRewritePrompt({ ...RECIPE, cookMinutes: 2, name: 'Tostada con tomate' }, 'Spanish (Spain)');

    expect(prompt).toContain('five to eight in all');
    expect(briefly).toContain('THREE TO FIVE steps');
    expect(assembled).toContain('TWO OR THREE steps');
    expect(briefly).not.toContain('five to eight in all');
    expect(assembled).not.toContain('THREE TO FIVE steps');
  });

  it('stops a barely-cooked dish inventing zero-minute steps', () => {
    const briefly = buildRewritePrompt({ ...RECIPE, cookMinutes: 2 }, 'Spanish (Spain)');

    expect(briefly).toContain('do not write `0`');
    expect(briefly).toContain('Plating and serving need no cue');
  });

  it('tells an assembled dish not to invent minutes or ceremony', () => {
    expect(assembled).toContain('do NOT');
    expect(assembled).toContain('invent ceremony');
    expect(assembled).toContain('An action that takes seconds has no minutes');
    expect(assembled).toContain('Most steps here have none');
  });

  it('fixes the dish, its ingredients and its times so the model rewrites rather than reinvents', () => {
    expect(prompt).toContain('Do not invent a different dish');
    expect(prompt).toContain('- Arroz integral — 300 g\n- Lomo de cerdo — 160 g');
    expect(prompt).toContain('1 serving(s) · 10 minutes preparation · 20 minutes cooking');
    expect(prompt).toContain('the complete list, for 1 serving(s); nothing else exists');
  });

  it('asks for every ingredient, named where it goes in, by its own name', () => {
    expect(prompt).toContain('name each one in the step where it goes in');
    expect(prompt).toContain('Call each ingredient by its name as written below, in lower case inside a sentence');
  });

  /** Why a food outside the list matters, said to the model as plainly as to a person. */
  it('says that the people eating it have allergies, and that an extra food is thrown away', () => {
    expect(prompt).toContain('The people who eat this have food allergies');
    expect(prompt).toContain('one that names a food outside the list is thrown away');
    expect(REWRITE_SYSTEM_PROMPT).toContain('professional chef');
    expect(REWRITE_SYSTEM_PROMPT).toContain('never add a food, a seasoning, a garnish or a serving suggestion');
  });

  /** The meal screen shows the list scaled to each portion; a figure in the text would contradict it. */
  it('keeps quantities out of the steps', () => {
    expect(prompt).toContain('No quantities in the steps');
  });

  it('asks for names in lower case, times in minutes, and nothing but the method', () => {
    expect(prompt).toContain('in lower case inside a sentence');
    expect(prompt).toContain('the time in minutes, never "the time indicated"');
    expect(prompt).toContain('No step about these instructions');
  });

  it('asks for technique, heat and food safety the way a professional would', () => {
    expect(prompt).toContain('HOW A PROFESSIONAL WRITES IT');
    expect(prompt).toContain('the oven in °C');
    expect(prompt).toContain('75 °C at the thickest part');
  });

  it('shows the method as it stands, so the model can see what to split', () => {
    expect(prompt).toContain('THE METHOD AS IT STANDS');
    expect(prompt).toContain('1. Saltear el lomo');
  });

  it('asks in the recipe’s own language', () => {
    expect(prompt).toContain('SPANISH (SPAIN)');
  });

  it('forbids ingredients that are not the dish’s, water aside', () => {
    expect(prompt).toContain('Use nothing else');
    expect(prompt).toContain('Water to boil, blanch or loosen is the one exception');
  });
});
