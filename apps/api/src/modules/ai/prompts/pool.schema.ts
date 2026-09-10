import { jsonSchema } from 'ai';
import { z } from 'zod';

import { hasUsableMethod, METHOD_RULES } from 'core/domain/Method';
import { MEAL_SLOTS } from 'core/entities/Plan';

/**
 * What the model is allowed to return.
 *
 * Note what is absent: no calories, no macros, no ingredient names. Only catalogue
 * slugs and gram quantities. There is nowhere for a generated nutrition figure to
 * be stored even by accident — macros are computed from the catalogue
 * (`docs/decisions/0004-deterministic-safety-layer.md`).
 */
export const generatedDishSchema = z.object({
  cookMinutes: z.number().int().min(0).max(180).describe('Minutos de cocción. 0 si no requiere cocinar.'),
  // The wire schema has no nullable, so 'none' arrives as an empty string.
  cuisine: z
    .string()
    .max(60)
    .nullish()
    .transform(value => value || null)
    .describe('Cocina de origen, por ejemplo "mediterranea".'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z
    .array(
      z.object({
        grams: z.number().positive().max(2000).describe('Gramos para el total de raciones indicado.'),
        slug: z.string().min(1).describe('Debe ser exactamente uno de los slugs disponibles.')
      })
    )
    .min(1)
    .max(12),
  name: z.string().min(1).max(120).describe('Nombre del plato en español.'),
  prepMinutes: z.number().int().min(0).max(120),
  servings: z.number().min(1).max(4).describe('Número de raciones que rinden las cantidades indicadas.'),
  slots: z.array(z.enum(MEAL_SLOTS)).min(1).describe('Momentos del día en los que este plato encaja.'),
  steps: z
    .array(
      z.object({
        // What to look for before moving on. Optional on the wire; the prompt asks for it.
        cue: z.string().max(160).optional(),
        minutes: z.number().int().min(0).max(240).optional(),
        // Twenty characters is the floor under "Cocer el arroz." — a step that names
        // an action and nothing about how, how hot or how long is not documented.
        text: z.string().min(20).max(400)
      })
    )
    .max(10)
    .describe('Pasos de preparación. Al menos uno, siempre.')
})
  /*
   * The floor lives here rather than only in the prompt because 2.1.0 asked for
   * three to eight steps and a quarter of the library still came back with none.
   * A dish that does not say how to make it is rejected and counted, not stored.
   */
  .refine(hasUsableMethod, {
    message: `needs at least ${METHOD_RULES.minStepsUncooked} step, and ${METHOD_RULES.minStepsCooked} when it is cooked`,
    path: ['steps']
  });

export const generatedPoolSchema = z.object({ dishes: z.array(generatedDishSchema).min(1).max(30) });

export type GeneratedDish = z.infer<typeof generatedDishSchema>;
export type GeneratedPool = z.infer<typeof generatedPoolSchema>;

// ── The wire schema ───────────────────────────────────────────────────────

/**
 * What we actually send the provider — hand-written JSON Schema, not converted
 * from Zod.
 *
 * Gemini accepts only a subset of OpenAPI 3.0 (`type`, `format`, `description`,
 * `enum`, `items`, `properties`, `required`, `nullable`) and rejects the whole
 * request with "Request contains an invalid argument" if anything else appears.
 * Converting the Zod schema above emits `minimum`, `maximum`, `maxLength`,
 * `additionalProperties` and — from `.nullable()` — `anyOf`, every one of which
 * trips it.
 *
 * So the split is deliberate: **this** is what the provider must be able to
 * express, and `generatedDishSchema` above is what we trust. The model's output is
 * re-parsed against the strict schema in `PoolBuilder` before anything is
 * accepted, so loosening the wire contract loosens nothing that matters — the
 * bounds are enforced on our side, where they always belonged
 * (`docs/decisions/0004-deterministic-safety-layer.md`).
 *
 * Keeping it hand-written also means a Zod change cannot silently reintroduce an
 * unsupported keyword. `pool.schema.spec.ts` asserts none are present.
 */
export const wirePoolSchema = jsonSchema<GeneratedPool>({
  properties: {
    dishes: {
      description: 'Los platos solicitados.',
      items: {
        properties: {
          cookMinutes: { description: 'Minutos de cocción. 0 si no requiere cocinar.', type: 'integer' },
          cuisine: { description: 'Cocina de origen, por ejemplo "mediterranea". Cadena vacía si no aplica.', type: 'string' },
          difficulty: { enum: ['easy', 'medium', 'hard'], type: 'string' },
          ingredients: {
            description: 'Entre 1 y 12 ingredientes, todos del catálogo.',
            items: {
              properties: {
                grams: { description: 'Gramos para el total de raciones indicado.', type: 'number' },
                slug: { description: 'Exactamente uno de los slugs disponibles.', type: 'string' }
              },
              required: ['grams', 'slug'],
              type: 'object'
            },
            type: 'array'
          },
          name: { description: 'Nombre del plato en español.', type: 'string' },
          prepMinutes: { description: 'Minutos de preparación.', type: 'integer' },
          servings: { description: 'Raciones que rinden las cantidades indicadas.', type: 'number' },
          slots: {
            description: 'Momentos del día en los que encaja.',
            items: { enum: [...MEAL_SLOTS], type: 'string' },
            type: 'array'
          },
          steps: {
            description: 'Pasos de preparación, uno por acción. Cada paso: qué hacer, cómo, a qué fuego y cuánto tiempo, y qué señal indica que está listo.',
            items: {
              properties: {
                cue: { description: 'La señal de que el paso está hecho: "hasta que los bordes doren", "hasta que deje de humear". Cadena vacía si no aplica.', type: 'string' },
                minutes: { description: 'Minutos que ocupa este paso. 0 si es instantáneo.', type: 'integer' },
                text: { description: 'La acción, en una a tres frases: qué, cómo, a qué fuego.', type: 'string' }
              },
              required: ['text'],
              type: 'object'
            },
            type: 'array'
          }
        },
        required: ['cookMinutes', 'cuisine', 'difficulty', 'ingredients', 'name', 'prepMinutes', 'servings', 'slots', 'steps'],
        type: 'object'
      },
      type: 'array'
    }
  },
  required: ['dishes'],
  type: 'object'
});
