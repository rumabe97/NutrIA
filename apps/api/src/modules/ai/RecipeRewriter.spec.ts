import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { RecipeController } from 'core/controllers/Recipe';

import { buildRewritePrompt } from './RewritePrompt.js';
import { PROMPT_VERSION } from './PoolPrompt.js';
import { RecipeRewriter } from './RecipeRewriter.service.js';
import { AiClient } from './clients/AiClient.js';

import type { AiRequest, AiResponse } from './clients/AiClient.js';
import type { UndocumentedRecipe } from 'core/controllers/Recipe';

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

const GOOD = {
  steps: [
    { cue: 'hasta que doren por fuera', minutes: 3, text: 'Cortar el lomo en tiras finas y saltearlo en la sartén a fuego vivo' },
    { cue: 'hasta que suelten su agua', minutes: 4, text: 'Añadir los champiñones laminados y seguir salteando' },
    { cue: '', minutes: 3, text: 'Verter el arroz cocido y remover para que se impregne del fondo' },
    { cue: 'hasta que esté bien caliente', minutes: 2, text: 'Rectificar de sal, saltear un par de minutos y servir' }
  ]
};

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

    return Promise.resolve({ object: (this.objects[this.prompts.length - 1] ?? this.objects[0]) as T, usage: { calls: 1, inputTokens: 0, model: 'scripted', outputTokens: 0 } });
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when no provider is configured', async () => {
    const pending = jest.spyOn(RecipeController, 'pendingStepUpgrades');

    expect(await new RecipeRewriter(new UnavailableAi()).rewriteOutdated(10)).toEqual({ pending: 0, rewritten: 0, skipped: 0 });
    expect(pending).not.toHaveBeenCalled();
  });

  it('asks only for recipes an older prompt wrote, and stamps the new one', async () => {
    const pending = jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    const run = await new RecipeRewriter(new ScriptedAi([GOOD])).rewriteOutdated(10);

    expect(pending).toHaveBeenCalledWith(PROMPT_VERSION, 10);
    expect(run).toEqual({ pending: 1, rewritten: 1, skipped: 0 });

    const [recipeId, steps, version] = rewrite.mock.calls[0] as [string, readonly { cue?: string; minutes?: number; text: string }[], string];

    expect(recipeId).toBe(RECIPE.id);
    expect(version).toBe(PROMPT_VERSION);
    expect(steps).toHaveLength(4);
    expect(steps[0]?.cue).toBe('hasta que doren por fuera');
    // An empty cue on the wire leaves as none, not as an empty string.
    expect(steps[2]?.cue).toBeUndefined();
  });

  it('refuses a rewrite that is still too compressed, and leaves the recipe for next time', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    // Three steps for a twenty-minute cook is exactly what this exists to replace.
    const run = await new RecipeRewriter(new ScriptedAi([{ steps: GOOD.steps.slice(0, 3) }])).rewriteOutdated(10);

    expect(run).toEqual({ pending: 1, rewritten: 0, skipped: 1 });
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('refuses a bare action, whatever else it returns', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE]);
    const rewrite = jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    const run = await new RecipeRewriter(new ScriptedAi([{ steps: [{ text: 'Cocer.' }, { text: 'Servir.' }, { text: 'Comer.' }, { text: 'Fin.' }] }])).rewriteOutdated(10);

    expect(run.rewritten).toBe(0);
    expect(rewrite).not.toHaveBeenCalled();
  });

  it('stops the sweep the moment the provider says it is out of budget', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE, { ...RECIPE, id: '22222222-2222-4222-8222-222222222222' }, { ...RECIPE, id: '33333333-3333-4333-8333-333333333333' }]);
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

    const run = await new RecipeRewriter(ai).rewriteOutdated(10);

    // One attempt, not three: the other two would have spent the allowance
    // plan generation needs on calls that could not have succeeded.
    expect(ai.calls).toBe(1);
    expect(run).toEqual({ pending: 3, rewritten: 0, skipped: 1 });
  });

  it('counts one failure and carries on with the rest', async () => {
    jest.spyOn(RecipeController, 'pendingStepUpgrades').mockResolvedValue([RECIPE, { ...RECIPE, id: '22222222-2222-4222-8222-222222222222' }]);
    jest.spyOn(RecipeController, 'rewriteSteps').mockResolvedValue(undefined);

    const run = await new RecipeRewriter(new ScriptedAi([{ steps: [] }, GOOD])).rewriteOutdated(10);

    expect(run).toEqual({ pending: 2, rewritten: 1, skipped: 1 });
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
    expect(prompt).toContain('Arroz integral 300 g, Lomo de cerdo 160 g');
    expect(prompt).toContain('10 minutes preparation, 20 minutes cooking');
    expect(prompt).toContain('add none, change no quantity');
  });

  it('shows the method as it stands, so the model can see what to split', () => {
    expect(prompt).toContain('THE METHOD AS IT STANDS');
    expect(prompt).toContain('1. Saltear el lomo');
  });

  it('asks in the recipe’s own language', () => {
    expect(prompt).toContain('SPANISH (SPAIN)');
  });

  it('forbids ingredients that are not the dish’s', () => {
    expect(prompt).toContain('Do not mention any ingredient that is not in the list above');
  });
});
