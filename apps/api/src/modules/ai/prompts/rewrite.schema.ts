import { jsonSchema } from 'ai';
import { z } from 'zod';

import { hasUsableMethod, METHOD_RULES } from 'core/domain/Method';

/**
 * What a rewrite may return: steps and nothing else.
 *
 * Deliberately narrow. The dish, its ingredients and its times are not the
 * model's to change here, so the schema gives it nowhere to put them — the same
 * reason `generatedDishSchema` has no field for calories.
 */
export const rewrittenStepsSchema = z
  .object({
    cookMinutes: z.number().int().min(0).max(240),
    steps: z
      .array(
        z.object({ cue: z.string().max(160).optional(), minutes: z.number().int().min(0).max(240).optional(), text: z.string().min(20).max(400) })
      )
      .min(1)
      .max(12)
  })
  .refine(hasUsableMethod, {
    message: `needs at least ${METHOD_RULES.minStepsUncooked} step, ${METHOD_RULES.minStepsCooked} when cooked and ${METHOD_RULES.minStepsCookedLong} when it cooks a while`,
    path: ['steps']
  });

export type RewrittenSteps = z.infer<typeof rewrittenStepsSchema>;

/**
 * The wire form. `cookMinutes` is echoed back only so the strict schema above can
 * apply the step floor for this dish's cooking time; it is never stored from here
 * — the recipe's own time is what counts and is not the model's to revise.
 */
export const wireRewriteSchema = jsonSchema<RewrittenSteps>({
  properties: {
    cookMinutes: { description: 'Repite aquí los minutos de cocción indicados en el enunciado.', type: 'integer' },
    steps: {
      description: 'Los pasos reescritos, uno por acción.',
      items: {
        properties: {
          cue: { description: 'La señal de que el paso está hecho. Cadena vacía si no aplica.', type: 'string' },
          minutes: { description: 'Minutos que ocupa este paso. 0 si es instantáneo.', type: 'integer' },
          text: { description: 'La acción: qué, cómo, a qué fuego.', type: 'string' }
        },
        required: ['text'],
        type: 'object'
      },
      type: 'array'
    }
  },
  required: ['cookMinutes', 'steps'],
  type: 'object'
});
