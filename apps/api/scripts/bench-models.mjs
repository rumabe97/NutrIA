#!/usr/bin/env node
/**
 * How does each free model behave on the pool prompt — does it answer inside
 * the gateway's limits, how long does it take, how many tokens does it spend,
 * and are the dishes it returns ones the pool builder would keep?
 *
 * For a fixed set of briefs (a standard omnivore and a vegan, at breakfast,
 * lunch, dinner and the afternoon snack) this builds the real pool prompt —
 * `buildPoolPrompt` and `POOL_SYSTEM_PROMPT` from the API's build, over the
 * dev catalogue cut by `core/domain/MealFit`'s `mealCatalogue` exactly as
 * `PoolBuilder` cuts it — and sends it to the gateway named by `AI_BASE_URL`,
 * with `wirePoolSchema` as a non-strict `json_schema` response format (what
 * `ai.config.ts`'s `nonStrictSchema` makes the SDK send). Each answer is then
 * scored the way `PoolBuilder` would read it:
 *
 * - `generatedDishSchema` from the build — the strict schema every dish passes;
 * - the slugs against the catalogue this request was shown (after the same cut):
 *   "unknown" is a slug in no catalogue row, "not shown" one the cut left out;
 * - `fitSlots` — "wrong meal" is a dish its own ingredients do not allow at the
 *   meal it was asked for (`0062` § 5);
 * - `methodMentions` — a method naming a food the dish does not contain;
 * - per-serving kcal, protein, carbohydrate and fat (`composePerServing`)
 *   against the brief the prompt gave that meal: the day × the meal's share of
 *   the default shape, as `PoolPrompt` computes it.
 *
 * Per call it records the status, the seconds, the tokens (cached and
 * reasoning included) and every `x-omniroute-*` header the gateway sent back.
 *
 * What it will not do:
 * - **Call a model that is not free.** Only ids ending in `:free` or starting
 *   with `groq/`, and never an id naming Gemini — the owner declined spending
 *   Gemini's requests on measurement (2026-09-25). A combo is refused too: its
 *   last step may be Gemini.
 * - **Call anything without `--yes`.** Without it, it lists the calls it would
 *   make and stops. Listing the gateway's models (`GET /models`) is free and is
 *   always made, so a model the gateway does not expose is dropped, and said.
 * - **Print a key.** The key is read from the variable `--key-env` names
 *   (default `OMNIROUTE_API_KEY`), goes into one header, and is scrubbed from
 *   anything the gateway echoes back before it is printed or written.
 * - **Write to a database**, or read production: `assertNotProduction`, then
 *   one `BEGIN ... READ ONLY` transaction, as `evaluate-plans.mjs` does. Its two
 *   people are built from a random id that names no account.
 * - **Retry.** A 413, a 429 or a timeout is recorded as such and the next call
 *   goes on.
 *
 * Pacing: one model's calls run one after another; different models run side
 * by side. A `groq/` model's calls start at least `--groq-gap` seconds apart
 * (Groq's free tier: 8,000 tokens a minute per model, and one request is about
 * half of that); any other model's at least `--gap` seconds apart (OpenRouter's
 * free tier: 20 requests a minute across models). Every call is abandoned after
 * `--timeout` seconds (the gateway cuts at 180). A timeout that fired well past
 * `--timeout` is marked `stalled`: this process was starved (a heavy build or
 * test run beside it), and the model may have answered in time — rerun it.
 *
 * `--max-tokens` sends a completion cap; without it none is sent, as
 * `PoolBuilder` sends none, and the gateway's or provider's default applies.
 *
 * Usage (from apps/api, after a build of core, database and api):
 *   node --env-file-if-exists=.env scripts/bench-models.mjs --list [--key-env NAME]
 *   node --env-file-if-exists=.env scripts/bench-models.mjs --models id,id,… --out <dir> [--yes]
 *     [--briefs omnivoro:lunch,vegano:dinner,…] [--dishes 6] [--month 1-12] [--seed text]
 *     [--locale es-ES] [--key-env NAME] [--timeout 200] [--gap 20] [--groq-gap 65]
 *     [--max-tokens N]
 *   node scripts/bench-models.mjs --summarise <dir> [--timeout 200]   (the table again; calls nothing)
 *
 * `--briefs` defaults to all eight (omnivoro and vegano × breakfast, lunch,
 * dinner, afternoon_snack); `--month` to this month; `--seed` to a fixed word, so
 * two runs show the same sample. Raw answers, the prompts and a summary go to
 * `--out` (keep it outside the repository).
 *
 * Exit codes: 0 done (or listed); 1 a failure before any call; 2 bad arguments
 * or a refused model.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertNotProduction } from '../../../.claude/skills/local-probe/scripts/guard.mjs';

import { RecipeController } from 'core/controllers/Recipe';
import { SafetyController } from 'core/controllers/Safety';
import { MEAL_SLOTS } from 'core/entities/Plan';
import { composePerServing } from 'core/domain/Composition';
import { CATALOGUE_SAMPLE_SIZE, fitSlots, mealCatalogue, offersPulses } from 'core/domain/MealFit';
import { DEFAULT_MEAL_SHAPE, weightsFor } from 'core/domain/MealShape';
import { methodMentions } from 'core/domain/Method';
import { resolvePreferences } from 'core/domain/Preference';

import { buildPoolPrompt, languageName, POOL_SYSTEM_PROMPT, PROMPT_VERSION } from '../dist/modules/ai/prompts/PoolPrompt.js';
import { generatedDishSchema, generatedPoolSchema, wirePoolSchema } from '../dist/modules/ai/prompts/pool.schema.js';

const PEOPLE = [
  { dietaryPatterns: [], slug: 'omnivoro' },
  { dietaryPatterns: ['vegan'], slug: 'vegano' }
];

const BRIEF_SLOTS = ['breakfast', 'lunch', 'dinner', 'afternoon_snack'];

/** The standard day of `PoolPrompt.spec.ts` and `catalogue-by-meal.mjs`: 2,400 kcal, both people. */
const STANDARD_TARGETS = { carbsG: 250, fatG: 70, fiberG: 30, kcal: 2400, proteinG: 150 };

const MACROS = ['kcal', 'proteinG', 'carbsG', 'fatG'];

/** Headers worth keeping besides the gateway's own. */
const KEPT_HEADERS = /^(x-omniroute-|x-correlation-id$|retry-after$|x-ratelimit-)/i;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const options = {
    briefs: null,
    dishes: 6,
    gap: 20,
    groqGap: 65,
    keyEnv: 'OMNIROUTE_API_KEY',
    list: false,
    locale: 'es-ES',
    maxTokens: null,
    models: [],
    month: new Date().getMonth() + 1,
    out: null,
    seed: 'bench-models',
    summarise: null,
    timeout: 200,
    yes: false,
    allowPaid: new Set(),
    reasoningEffort: null
  };
  const next = index => {
    const value = argv[index + 1];

    if (value === undefined) {
      fail(`${argv[index]} takes a value`);
    }

    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--allow-paid':
        options.allowPaid = new Set(
          next(index)
            .split(',')
            .map(model => model.trim())
            .filter(Boolean)
        );
        index += 1;
        break;
      case '--reasoning-effort':
        options.reasoningEffort = next(index);
        index += 1;
        break;
      case '--briefs':
        options.briefs = next(index).split(',').filter(Boolean);
        index += 1;
        break;
      case '--dishes':
        options.dishes = Number(next(index));
        index += 1;
        break;
      case '--gap':
        options.gap = Number(next(index));
        index += 1;
        break;
      case '--groq-gap':
        options.groqGap = Number(next(index));
        index += 1;
        break;
      case '--key-env':
        options.keyEnv = next(index);
        index += 1;
        break;
      case '--list':
        options.list = true;
        break;
      case '--locale':
        options.locale = next(index);
        index += 1;
        break;
      case '--max-tokens':
        options.maxTokens = Number(next(index));
        index += 1;
        break;
      case '--models':
        options.models = next(index)
          .split(',')
          .map(model => model.trim())
          .filter(Boolean);
        index += 1;
        break;
      case '--month':
        options.month = Number(next(index));
        index += 1;
        break;
      case '--out':
        options.out = next(index);
        index += 1;
        break;
      case '--summarise':
        options.summarise = next(index);
        index += 1;
        break;
      case '--seed':
        options.seed = next(index);
        index += 1;
        break;
      case '--timeout':
        options.timeout = Number(next(index));
        index += 1;
        break;
      case '--yes':
        options.yes = true;
        break;
      default:
        fail(`unknown argument: ${arg}`);
    }
  }

  if (options.reasoningEffort !== null && !['none', 'minimal', 'low', 'medium', 'high'].includes(options.reasoningEffort)) {
    fail('--reasoning-effort takes none, minimal, low, medium or high');
  }

  if (!Number.isInteger(options.month) || options.month < 1 || options.month > 12) {
    fail('--month takes 1 to 12');
  }

  if (options.maxTokens !== null && (!Number.isInteger(options.maxTokens) || options.maxTokens < 1)) {
    fail('--max-tokens takes a whole number of tokens');
  }

  if (!Number.isInteger(options.dishes) || options.dishes < 1 || options.dishes > 30) {
    fail('--dishes takes 1 to 30');
  }

  for (const name of ['gap', 'groqGap', 'timeout']) {
    if (!Number.isFinite(options[name]) || options[name] < 0) {
      fail(`--${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)} takes a number of seconds`);
    }
  }

  if (!/^[A-Z][A-Z0-9_]*$/.test(options.keyEnv)) {
    fail('--key-env takes the NAME of an environment variable, never its value');
  }

  const every = PEOPLE.flatMap(person => BRIEF_SLOTS.map(slot => `${person.slug}:${slot}`));

  options.briefs ??= every;

  for (const brief of options.briefs) {
    if (!every.includes(brief)) {
      fail(`unknown brief ${brief}; one of ${every.join(', ')}`);
    }
  }

  if (options.summarise) {
    return options;
  }

  if (!options.list && options.models.length === 0) {
    fail('--models takes a comma-separated list of model ids (see --list)');
  }

  if (!options.list && !options.out) {
    fail('--out <dir> is required: raw answers are written there (keep it outside the repository)');
  }

  return options;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

/**
 * Whether a model id is one this script may call: a free tier only, never Gemini.
 * `null` when it may; the reason otherwise.
 */
function refusal(model, options) {
  if (/gemini/i.test(model)) {
    return 'names Gemini — the owner declined spending its requests (2026-09-25)';
  }

  // A paid model only when the owner named it for this run (`--allow-paid`),
  // and then every request carries the no-training, no-retention constraint.
  if (!model.endsWith(':free') && !model.startsWith('groq/') && !options.allowPaid.has(model)) {
    return 'is not a free model and was not named in --allow-paid';
  }

  return null;
}

// ---------------------------------------------------------------------------
// The gateway
// ---------------------------------------------------------------------------
function gatewayOf(options) {
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/+$/, '');
  const key = process.env[options.keyEnv];

  if (!baseUrl) {
    throw new Error('AI_BASE_URL is not set (run with --env-file-if-exists=.env from apps/api)');
  }

  if (!key) {
    throw new Error(`${options.keyEnv} is not set`);
  }

  /** Anything the gateway says, with the key taken out before it is shown or kept. */
  const scrub = text => (typeof text === 'string' ? text.split(key).join('[redacted]') : text);

  return { baseUrl, key, scrub };
}

async function listModels(gateway) {
  const response = await fetch(`${gateway.baseUrl}/models`, {
    headers: { authorization: `Bearer ${gateway.key}` },
    signal: AbortSignal.timeout(30_000)
  });
  const text = gateway.scrub(await response.text());

  if (!response.ok) {
    throw new Error(`GET /models answered ${response.status}: ${text.slice(0, 300)}`);
  }

  const body = JSON.parse(text);

  return (body.data ?? []).map(entry => entry.id).sort();
}

/** One request, as `ai.config.ts`'s provider sends it: system + user, `wirePoolSchema` as non-strict `json_schema`. */
async function call(gateway, model, request, options) {
  const started = Date.now();
  const record = { brief: request.id, model, startedAt: new Date(started).toISOString() };

  try {
    const response = await fetch(`${gateway.baseUrl}/chat/completions`, {
      body: JSON.stringify({
        messages: [
          { content: POOL_SYSTEM_PROMPT, role: 'system' },
          { content: request.prompt, role: 'user' }
        ],
        model,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        // Paid models: only endpoints that neither retain nor train on what is
        // sent (the owner's rule, 2026-09-25), and the answer carries its cost.
        ...(options.allowPaid.has(model)
          ? { provider: { data_collection: 'deny', require_parameters: true, zdr: true }, usage: { include: true } }
          : {}),
        ...(options.reasoningEffort === 'none'
          ? { reasoning: { enabled: false } }
          : options.reasoningEffort
            ? { reasoning: { effort: options.reasoningEffort } }
            : {}),
        response_format: { json_schema: { name: 'response', schema: wirePoolSchema.jsonSchema, strict: false }, type: 'json_schema' }
      }),
      headers: { authorization: `Bearer ${gateway.key}`, 'content-type': 'application/json', 'x-omniroute-session': `bench:${request.id}` },
      method: 'POST',
      signal: AbortSignal.timeout(options.timeout * 1000)
    });
    const text = gateway.scrub(await response.text());

    record.status = response.status;
    record.seconds = (Date.now() - started) / 1000;
    record.headers = Object.fromEntries(
      [...response.headers].filter(([name]) => KEPT_HEADERS.test(name)).map(([name, value]) => [name, gateway.scrub(value)])
    );
    record.raw = text;

    if (!response.ok) {
      record.error = String(response.status);

      return record;
    }

    let body;

    try {
      body = JSON.parse(text);
    } catch {
      record.error = 'body_not_json';

      return record;
    }

    const usage = body.usage ?? {};

    record.answeredModel = body.model ?? null;
    record.provider = body.provider ?? null;
    record.costUsd = typeof usage.cost === 'number' ? usage.cost : null;
    record.finishReason = body.choices?.[0]?.finish_reason ?? null;
    record.tokens = {
      cached: usage.prompt_tokens_details?.cached_tokens ?? usage.cache_read_input_tokens ?? null,
      input: usage.prompt_tokens ?? null,
      output: usage.completion_tokens ?? null,
      reasoning: usage.completion_tokens_details?.reasoning_tokens ?? null
    };
    record.content = body.choices?.[0]?.message?.content ?? null;

    if (typeof record.content !== 'string' || record.content.trim() === '') {
      record.error = 'empty_answer';
    }
  } catch (error) {
    record.seconds = (Date.now() - started) / 1000;
    record.error = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network';
    // The timer fired late: the event loop was starved, and an answer that
    // arrived meanwhile lost the race to it.
    record.stalled = record.error === 'timeout' && record.seconds > options.timeout + 10;
    record.detail = gateway.scrub(error instanceof Error ? error.message : String(error));
  }

  return record;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** The JSON in an answer: strict first, then out of a Markdown fence or the outermost braces. */
function readJson(content) {
  try {
    return { json: JSON.parse(content), strict: true };
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(content)?.[1];
    const braces = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);

    for (const candidate of [fenced, braces]) {
      try {
        return candidate ? { json: JSON.parse(candidate), strict: false } : null;
      } catch {
        // try the next
      }
    }

    return null;
  }
}

function score(record, request, catalogue) {
  const result = { dishes: 0, foreignFood: 0, json: false, jsonStrict: false, notShown: 0, schemaValid: 0, unknownSlug: 0, valid: 0, wrongMeal: 0 };

  result.deviations = [];
  result.issues = [];

  if (record.error || typeof record.content !== 'string') {
    return result;
  }

  const read = readJson(record.content);

  if (!read) {
    return result;
  }

  result.json = true;
  result.jsonStrict = read.strict;

  const dishes = Array.isArray(read.json?.dishes) ? read.json.dishes : null;

  if (!dishes) {
    result.issues.push('no "dishes" array');

    return result;
  }

  result.dishes = dishes.length;
  result.poolValid = generatedPoolSchema.safeParse(read.json).success;

  const shown = new Set(request.shownSlugs);
  const vocabulary = [...catalogue.values()].map(ingredient => ingredient.name);

  for (const raw of dishes) {
    const parsed = generatedDishSchema.safeParse(raw);

    if (!parsed.success) {
      result.issues.push(`${raw?.name ?? '?'}: ${parsed.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
      continue;
    }

    result.schemaValid += 1;

    const dish = parsed.data;
    const unknown = dish.ingredients.filter(item => !catalogue.has(item.slug)).map(item => item.slug);
    const hidden = dish.ingredients.filter(item => catalogue.has(item.slug) && !shown.has(item.slug)).map(item => item.slug);

    if (unknown.length > 0) {
      result.unknownSlug += 1;
      result.issues.push(`${dish.name}: unknown ${unknown.join(', ')}`);
    }

    if (hidden.length > 0) {
      result.notShown += 1;
      result.issues.push(`${dish.name}: not shown ${hidden.join(', ')}`);
    }

    if (unknown.length > 0) {
      continue;
    }

    const fitted = fitSlots(dish, catalogue, request.dietaryPatterns);
    const wrongMeal = !fitted.includes(request.slot);
    const foreign = methodMentions({
      dish: dish.ingredients.map(item => catalogue.get(item.slug)?.name ?? item.slug),
      name: dish.name,
      steps: dish.steps,
      vocabulary
    }).foreign;

    if (wrongMeal) {
      result.wrongMeal += 1;
      result.issues.push(`${dish.name}: not servable at ${request.slot} (fits ${fitted.join(', ') || 'nothing'})`);
    }

    if (foreign.length > 0) {
      result.foreignFood += 1;
      result.issues.push(`${dish.name}: method names ${foreign.join(', ')}`);
    }

    const composed = composePerServing(dish, catalogue);

    if (composed.ok) {
      result.deviations.push(
        Object.fromEntries(
          MACROS.map(macro => [macro, request.brief[macro] ? ((composed.macros[macro] - request.brief[macro]) / request.brief[macro]) * 100 : 0])
        )
      );
    }

    if (!wrongMeal && foreign.length === 0 && hidden.length === 0) {
      result.valid += 1;
    }
  }

  return result;
}

function median(values) {
  const sorted = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);

  if (sorted.length === 0) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarise(model, records) {
  const answered = records.filter(record => !record.error);
  const errors = {};

  for (const record of records.filter(entry => entry.error)) {
    const kind = record.stalled ? `${record.error} (stalled)` : record.error;

    errors[kind] = (errors[kind] ?? 0) + 1;
  }

  const sum = key => records.reduce((total, record) => total + (record.score?.[key] ?? 0), 0);
  const deviations = records.flatMap(record => record.score?.deviations ?? []);

  return {
    answered: answered.length,
    cachedAny: answered.some(record => (record.tokens?.cached ?? 0) > 0),
    calls: records.length,
    dishes: sum('dishes'),
    errors,
    foreignFood: sum('foreignFood'),
    jsonAnswers: records.filter(record => record.score?.json).length,
    jsonStrict: records.filter(record => record.score?.jsonStrict).length,
    medianAbsDeviation: Object.fromEntries(MACROS.map(macro => [macro, median(deviations.map(deviation => Math.abs(deviation[macro])))])),
    medianInputTokens: median(answered.map(record => record.tokens?.input)),
    medianOutputTokens: median(answered.map(record => record.tokens?.output)),
    medianReasoningTokens: median(answered.map(record => record.tokens?.reasoning)),
    medianSeconds: median(answered.map(record => record.seconds)),
    model,
    notShown: sum('notShown'),
    providers: [...new Set(records.map(record => record.headers?.['x-omniroute-provider']).filter(Boolean))],
    schemaValid: sum('schemaValid'),
    unknownSlug: sum('unknownSlug'),
    valid: sum('valid'),
    wrongMeal: sum('wrongMeal')
  };
}

// ---------------------------------------------------------------------------
// The briefs — built from the dev catalogue inside one read-only transaction.
// ---------------------------------------------------------------------------
async function buildRequests(options) {
  const require = createRequire(import.meta.url);
  const databaseModule = require('database');
  const originalDatabase = databaseModule.database;
  const pooled = originalDatabase();
  // `PoolPrompt`'s `sharesOf`: the default shape eats every brief's slot, so
  // each meal's share is its weight over the day's.
  const shares = weightsFor(DEFAULT_MEAL_SHAPE);
  const total = [...shares.values()].reduce((sum, share) => sum + share, 0) || 1;
  let built;

  try {
    await pooled.transaction(
      async tx => {
        databaseModule.database = () => tx;

        try {
          const context = await RecipeController.nobodysContext();
          const allergenIdsByKey = new Map((await SafetyController.listAllergens()).map(allergen => [allergen.key, allergen.id]));
          const base = { ...context, allergenIdsByKey, locale: options.locale };
          const ingredients = [...base.catalogue.values()];
          const requests = [];

          for (const person of PEOPLE) {
            const preferences = resolvePreferences({
              allergenIdsByKey,
              dietaryPatterns: person.dietaryPatterns,
              dislikedLabels: [],
              ingredients,
              maxMinutesPerDish: null
            });
            // eslint-disable-next-line no-await-in-loop -- one person at a time inside one transaction.
            const usage = await RecipeController.libraryUsage(MEAL_SLOTS, { ...base, dietaryPatterns: person.dietaryPatterns, preferences });
            // What `PoolBuilder` shows: every row this person may eat (nobody declared an allergy), cut per meal.
            const eatable = ingredients.filter(ingredient => !preferences.excludedIngredientIds.has(ingredient.id));

            for (const slot of BRIEF_SLOTS) {
              const id = `${person.slug}:${slot}`;

              if (!options.briefs.includes(id)) {
                continue;
              }

              const used = usage.get(slot);
              const shown = mealCatalogue(eatable, slot, person.dietaryPatterns, used ? { month: options.month, seed: options.seed, used } : null);
              const prompt = buildPoolPrompt(
                {
                  avoidNames: [],
                  budget: null,
                  cookingFrequency: null,
                  cookingTimeMinutes: 30,
                  cuisines: [],
                  dayShape: null,
                  dietaryPatterns: person.dietaryPatterns,
                  dislikedNames: [],
                  excludeSlugs: [],
                  goal: null,
                  language: languageName(options.locale),
                  likedFoods: [],
                  lovedNames: [],
                  month: options.month,
                  needBySlot: new Map([[slot, options.dishes]]),
                  slotShares: shares,
                  targets: STANDARD_TARGETS
                },
                shown,
                { pulses: offersPulses(eatable, slot, person.dietaryPatterns) }
              );
              const share = (shares.get(slot) ?? 0) / total;

              requests.push({
                brief: Object.fromEntries(MACROS.map(macro => [macro, Math.round(STANDARD_TARGETS[macro] * share)])),
                dietaryPatterns: person.dietaryPatterns,
                id,
                prompt,
                shownSlugs: shown.map(ingredient => ingredient.slug),
                slot
              });
            }
          }

          built = { catalogue: base.catalogue, requests };
        } finally {
          databaseModule.database = originalDatabase;
        }
      },
      { accessMode: 'read only' }
    );
  } finally {
    await databaseModule.closeDatabase();
  }

  return built;
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** One model's calls, one after another, each starting at least `gap` seconds after the last started. */
async function runModel(gateway, model, requests, catalogue, options) {
  const gapMs = (model.startsWith('groq/') ? options.groqGap : options.gap) * 1000;
  const records = [];
  let lastStart = 0;

  for (const request of requests) {
    const wait = lastStart + gapMs - Date.now();

    if (lastStart > 0 && wait > 0) {
      // eslint-disable-next-line no-await-in-loop -- pacing to the provider's per-minute limit is the point.
      await sleep(wait);
    }

    lastStart = Date.now();

    // eslint-disable-next-line no-await-in-loop -- one model's calls are sequential on purpose.
    const record = await call(gateway, model, request, options);

    record.promptChars = request.prompt.length;
    record.score = score(record, request, catalogue);
    records.push(record);

    const safeName = `${model.replace(/[^\w.-]+/g, '_')}__${request.id.replace(':', '_')}.json`;

    writeFileSync(join(options.out, safeName), JSON.stringify(record, null, 2));

    const tokens = record.tokens ? ` in ${record.tokens.input} out ${record.tokens.output} cached ${record.tokens.cached ?? '-'}` : '';

    console.log(
      `  ${model} ${request.id}: ${record.error ?? record.status}${record.stalled ? ' (STALLED: rerun)' : ''} ${record.seconds?.toFixed(1)} s${record.finishReason ? ` (${record.finishReason})` : ''}${tokens} — dishes ${record.score.dishes}, valid ${record.score.valid}`
    );
  }

  return records;
}

function fmt(value, digits = 0) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(digits);
}

function table(summaries) {
  const lines = [
    '| Model | Answered | Errors | Median s | Median tokens in / out (reasoning) | Cached > 0 | JSON (strict) | Dishes | Schema-valid | Unknown slug | Not shown | Wrong meal | Foreign food | Valid | Median abs deviation kcal / P / C / F |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ];

  for (const entry of summaries) {
    const errors = Object.entries(entry.errors)
      .map(([kind, count]) => `${kind} ×${count}`)
      .join(', ');
    const deviation = MACROS.map(macro => (entry.medianAbsDeviation[macro] === null ? '—' : `${fmt(entry.medianAbsDeviation[macro])}%`)).join(' / ');

    lines.push(
      `| \`${entry.model}\` | ${entry.answered}/${entry.calls} | ${errors || '—'} | ${fmt(entry.medianSeconds)} | ${fmt(entry.medianInputTokens)} / ${fmt(entry.medianOutputTokens)} (${fmt(entry.medianReasoningTokens)}) | ${entry.answered === 0 ? '—' : entry.cachedAny ? 'yes' : 'no'} | ${entry.jsonAnswers} (${entry.jsonStrict}) | ${entry.dishes} | ${entry.schemaValid} | ${entry.unknownSlug} | ${entry.notShown} | ${entry.wrongMeal} | ${entry.foreignFood} | ${entry.valid} | ${deviation} |`
    );
  }

  return lines.join('\n');
}

/**
 * The table again from a run's records, calling nothing: after a call was
 * rerun into the same directory (its file replaced), or to mark the timeouts
 * that fired past `--timeout` as stalled.
 */
function summariseDirectory(options) {
  const records = readdirSync(options.summarise)
    .filter(name => name.endsWith('.json') && name !== 'summary.json')
    .map(name => JSON.parse(readFileSync(join(options.summarise, name), 'utf8')))
    .map(record => ({ ...record, stalled: record.error === 'timeout' && record.seconds > options.timeout + 10 }));
  const models = [...new Set(records.map(record => record.model))];
  const summaries = models.map(model =>
    summarise(
      model,
      records.filter(record => record.model === model)
    )
  );
  const markdown = table(summaries);

  writeFileSync(join(options.summarise, 'summary.md'), `${markdown}\n`);
  console.log(`${records.length} records.\n\n${markdown}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.summarise) {
    summariseDirectory(options);

    return;
  }

  const gateway = gatewayOf(options);
  const listed = await listModels(gateway);

  if (options.list) {
    console.log(`${listed.length} models listed by the gateway; "free" marks the ones this script may call:`);

    for (const id of listed) {
      console.log(`  ${refusal(id, options) ? '    ' : 'free'}  ${id}`);
    }

    return;
  }

  const refused = options.models.map(model => [model, refusal(model, options)]).filter(([, reason]) => reason);

  if (refused.length > 0) {
    for (const [model, reason] of refused) {
      console.error(`refused: ${model} ${reason}`);
    }

    process.exit(2);
  }

  const missing = options.models.filter(model => !listed.includes(model));
  const models = options.models.filter(model => listed.includes(model));

  for (const model of missing) {
    console.log(`dropped: ${model} is not listed by the gateway's /models`);
  }

  assertNotProduction();

  const { catalogue, requests } = await buildRequests(options);
  const calls = models.length * requests.length;
  const groq = models.filter(model => model.startsWith('groq/')).length * requests.length;

  console.log(
    `Prompt ${PROMPT_VERSION}. ${options.dishes} dishes a request, ${STANDARD_TARGETS.kcal} kcal day (${STANDARD_TARGETS.proteinG} P / ${STANDARD_TARGETS.carbsG} C / ${STANDARD_TARGETS.fatG} F), default meal shape.`
  );
  console.log(
    `Month ${options.month}, seed "${options.seed}", sample ${CATALOGUE_SAMPLE_SIZE}, locale ${options.locale}. Key from ${options.keyEnv}.`
  );

  for (const request of requests) {
    console.log(
      `  ${request.id.padEnd(24)} ${String(request.shownSlugs.length).padStart(4)} rows, ${String(request.prompt.length).padStart(6)} chars, brief ${MACROS.map(macro => request.brief[macro]).join(' / ')}`
    );
  }

  console.log(`\n${calls} calls: ${models.length} models × ${requests.length} briefs (${groq} to groq/, ${calls - groq} to others).`);

  if (!options.yes) {
    console.log('Nothing called. Add --yes to make them.');

    return;
  }

  if (calls === 0) {
    return;
  }

  mkdirSync(options.out, { recursive: true });

  for (const request of requests) {
    writeFileSync(join(options.out, `prompt__${request.id.replace(':', '_')}.txt`), `${POOL_SYSTEM_PROMPT}\n\n---\n\n${request.prompt}`);
  }

  const startedAt = new Date().toISOString();
  const results = await Promise.all(models.map(model => runModel(gateway, model, requests, catalogue, options)));
  const summaries = models.map((model, index) => summarise(model, results[index]));
  const markdown = table(summaries);

  writeFileSync(
    join(options.out, 'summary.json'),
    JSON.stringify(
      {
        dishes: options.dishes,
        locale: options.locale,
        month: options.month,
        promptVersion: PROMPT_VERSION,
        seed: options.seed,
        startedAt,
        summaries,
        targets: STANDARD_TARGETS
      },
      null,
      2
    )
  );
  writeFileSync(join(options.out, 'summary.md'), `${markdown}\n`);
  console.log(`\n${markdown}\n\nWritten to ${options.out}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
