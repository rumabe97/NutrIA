#!/usr/bin/env node
/**
 * Draft the dishes the appliances in `APPLIANCES` have nothing to offer for —
 * project 021 phase 8, "a library that cooks with more than a pan".
 *
 * Six of the ten appliances a person may now name cannot serve a single dish
 * (`0102` § *What it costs, measured*), and a preference the library cannot serve
 * is the hint `marketing` refused to let this feature sell. This asks the model
 * for them, through the machinery a plan already uses, and writes what passes
 * every gate to a SQL file **under `docs/local/`** for the owner to load — never
 * to a migration (hundreds of inserts do not belong in the API's build), and
 * never to a database of its own accord.
 *
 * What it is, precisely:
 *
 * - **`PoolBuilder.build()` from the API's own build**, not a copy of it. The
 *   prompt is `buildPoolPrompt`, the wire schema is `wirePoolSchema`, and every
 *   dish that comes back passes `validate` → `judge` in the order a generation
 *   runs them: the strict schema, the catalogue (near-miss slugs repaired), the
 *   **allergy gate**, the way of eating, the time limit, `withinEquipment`, the
 *   method read back, the meals its ingredients allow, and last the serving
 *   ceiling (`0070`). Nothing here re-implements a gate, so nothing here can
 *   disagree with one.
 * - **Each dish declares its own `equipment`** (`0102`), because the schema asks
 *   for it. No prose is read and nothing is inferred — which is the whole reason
 *   this phase exists rather than a second backfill.
 * - **Steered by the kitchen and by the wish**, both fields the prompt context
 *   already has: the appliance is marked `prefers`, every other appliance
 *   outside the default kitchen is `missing` (so a draft cannot need a second
 *   appliance nobody has), and the wish names the appliance. The wish is needed
 *   because the preference alone steers nothing — project 021 phase 6 step 3
 *   measured **zero** air-fryer dishes from a preferred air fryer, which is
 *   `0102`'s own point that a preference is a wish and may never remove a dish.
 * - **A dish the model wrote without declaring the appliance is dropped and
 *   counted.** That count is the measurement phase 6 could not make: how far the
 *   preference actually steers.
 *
 * What it will not do:
 *
 * - **Touch production, or any database but the local one.** `assertNotProduction`
 *   first, then one `BEGIN … READ ONLY` transaction to read the catalogue, the
 *   allergens, the library's usage and its slugs — closed before the first model
 *   call, because a transaction held open across forty minutes of network is a
 *   transaction held open for forty minutes.
 * - **Write a row.** Its output is a file.
 * - **Run past a ceiling.** `--max-usd` sums what the gateway says each call
 *   cost and stops the run; without `--yes` nothing is called at all.
 *
 * Usage, from the repository root, after a build of core, database and api:
 *
 *   NUTRIA_LOCAL_PG=1 node --env-file-if-exists=apps/api/.env \
 *     apps/api/scripts/draft-equipment-batch.mjs --plan
 *
 *   NUTRIA_LOCAL_PG=1 node --env-file-if-exists=apps/api/.env \
 *     apps/api/scripts/draft-equipment-batch.mjs --yes \
 *     [--only air_fryer[:lunch]] [--target 12] [--max-usd 2] [--passes 6]
 *     [--concurrency 3] [--out docs/local/021-equipment-batch.sql]
 *
 *   node apps/api/scripts/draft-equipment-batch.mjs --check docs/local/021-equipment-batch.sql
 *
 * `--plan` prints the cells and the calls it would make and stops. `--check`
 * re-runs every gate over the dishes the file holds, from the JSON sidecar
 * written beside it, and calls nothing.
 *
 * Exit codes: 0 done; 1 a cell came back short, or `--check` found a dish that
 * no longer passes; 2 bad arguments or a failure before any call.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { assertNotProduction } from '../../../.claude/skills/local-probe/scripts/guard.mjs';

import { APPLIANCES, DEFAULT_KITCHEN } from 'core/entities/Kitchen';
import { MEAL_SLOTS } from 'core/entities/Plan';
import { RecipeController } from 'core/controllers/Recipe';
import { SafetyController } from 'core/controllers/Safety';
import { composePerServing } from 'core/domain/Composition';
import { dishSafety } from 'core/domain/Safety';
import { DEFAULT_MEAL_SHAPE, weightsFor } from 'core/domain/MealShape';
import { hasUsableMethod } from 'core/domain/Method';
import { isOversized } from 'core/domain/Serving';
import { dishGroups } from 'core/domain/MealFit';
import { resolvePreferences, withinEquipment, withinTime } from 'core/domain/Preference';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const { PoolBuilder } = await import(pathToFileURL(join(ROOT, 'apps/api/dist/modules/ai/services/PoolBuilder.service.js')).href);
const { StructuredAiClient } = await import(pathToFileURL(join(ROOT, 'apps/api/dist/modules/ai/clients/StructuredAiClient.js')).href);
const { resolveCallSettings, resolveModel, resolveOutputCap } = await import(pathToFileURL(join(ROOT, 'apps/api/dist/modules/ai/ai.config.js')).href);
const { providerCredentials } = await import(pathToFileURL(join(ROOT, 'apps/api/dist/modules/ai/clients/redact.js')).href);
const { PROMPT_VERSION } = await import(pathToFileURL(join(ROOT, 'apps/api/dist/modules/ai/prompts/PoolPrompt.js')).href);
const { validateEnv } = await import(pathToFileURL(join(ROOT, 'apps/api/dist/config/Env.validation.js')).href);

// ---------------------------------------------------------------------------
// The table: which slots each appliance plausibly serves, and why
// ---------------------------------------------------------------------------

/**
 * Two rules applied to every cell before any of them was argued.
 *
 * **Supper is excluded for every appliance.** It is the thinnest slot (60 of
 * 1,130 es-ES dishes) and the rarest shape — `shapeFor` turns it on only for
 * four meals without snacks, or six meals — so twelve dishes there is a fifth of
 * the slot gated on one appliance, and a *recena* is by definition light and
 * immediate. Supper wants growing; it does not want growing with dishes that
 * need a machine.
 *
 * **"Requires" means the recipe as written.** `0067`'s rule read forwards: a
 * dish that offers a choice declares neither, so a dish whose method is built
 * around one appliance, offering no alternative, declares it. It is the only
 * honest reading under which a rice cooker or a steamer can carry a dish at
 * all, and it is the standard production's 65 oven dishes already meet.
 */
const CELLS = [
  // The oven's lunch (37) and dinner (45) are long past the rotation's cap; its
  // snacks are 1 and 3. Batch-baked snacks — muffins de avena, barritas,
  // bizcocho — are what those slots are.
  { appliance: 'oven', slots: ['breakfast', 'morning_snack', 'afternoon_snack'], why: 'baked breakfasts and batch-baked snacks; lunch and dinner are past the cap' },
  // Its claim is speed at the small meals. A microwave *main* that could not be
  // done on a hob is a weak declaration, so lunch and dinner are left out.
  { appliance: 'microwave', slots: ['breakfast', 'morning_snack', 'afternoon_snack'], why: 'speed at the small meals; a microwave main is a weak declaration' },
  // Zero at both main meals today: a blender lunch is a cream or a gazpacho,
  // never a smoothie.
  { appliance: 'blender', slots: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'], why: 'creams and cold soups at the main meals, which it has none of' },
  // Mains and crisp snacks. Breakfast and mid-morning are out: an air-fryer
  // breakfast is a reheat, not a dish.
  { appliance: 'air_fryer', slots: ['lunch', 'afternoon_snack', 'dinner'], why: 'mains and crisp snacks' },
  { appliance: 'pressure_cooker', slots: ['lunch', 'dinner'], why: 'legumes, stews, stocks and rice; nothing it does belongs at a snack' },
  // Parrilla and barbacoa only: a *plancha* on the hob is `stovetop`, which is
  // what keeps this declaration narrow.
  { appliance: 'grill', slots: ['lunch', 'dinner'], why: 'parrilla and barbacoa; a plancha on the hob is stovetop' },
  { appliance: 'steamer', slots: ['lunch', 'dinner'], why: 'fish, dumplings and delicate veg — the narrowest claim of the ten but one' },
  { appliance: 'slow_cooker', slots: ['lunch', 'dinner'], why: 'long braises; see the time finding in the hand-back' },
  { appliance: 'rice_cooker', slots: ['lunch', 'dinner'], why: 'rice dishes written for it — the weakest claim of the ten' }
];

/**
 * What the library already holds for a cell, so a target is a shortfall and not a quota.
 *
 * **Counted, not remembered** (2026-10-18, the second batch): one query over
 * `recipes` with `equipment` and `meal_slots` unnested, `locale = 'es-ES'`, on a
 * database holding what production holds after the first batch was loaded. The
 * table it replaced was written before that load and read `air_fryer: 0` while
 * the library held thirty — which would have asked for thirty more of what it
 * already had. Anybody drafting a third batch counts again rather than trusting
 * this block: it is a measurement with a date, not a constant.
 */
const HELD = {
  air_fryer: { afternoon_snack: 6, dinner: 12, lunch: 12 },
  blender: { afternoon_snack: 12, breakfast: 12, dinner: 9, lunch: 11, morning_snack: 11, supper: 1 },
  grill: { dinner: 12, lunch: 11 },
  microwave: { afternoon_snack: 10, breakfast: 13, morning_snack: 9, supper: 2 },
  oven: { afternoon_snack: 3, breakfast: 12, dinner: 43, lunch: 34, morning_snack: 1, supper: 3 },
  pressure_cooker: { dinner: 7, lunch: 9 },
  rice_cooker: { dinner: 7, lunch: 11 },
  steamer: { dinner: 12, lunch: 11 }
};

/**
 * The briefs a cell's dishes are drafted across, so the batch is spread rather
 * than counted (the plan's step 2, and the trap that would waste it).
 *
 * Thirty air-fryer dishes that are all chicken breast leave a day unable to
 * reach four macros (`0045`). A *vegan* brief is what actually stops that: the
 * catalogue the request is shown holds no meat, so the model cannot write one.
 * `gluten_free` and `lactose_free` are chosen deliberately — `patron-sin-gluten`
 * (444) and `alergia-lacteos` (470) are the two smallest pools in phase 6's
 * table, so a dish drafted inside those exclusions lands where it is worth most.
 * The two kcal extremes make the model size plates differently.
 */
const BRIEFS = [
  { slug: 'omnivoro-2400', patterns: [], targets: { carbsG: 250, fatG: 80, fiberG: 30, kcal: 2400, proteinG: 150 } },
  { slug: 'vegano-2000', patterns: ['vegan'], targets: { carbsG: 240, fatG: 65, fiberG: 35, kcal: 2000, proteinG: 110 } },
  { slug: 'sin-gluten-2400', patterns: ['gluten_free'], targets: { carbsG: 250, fatG: 80, fiberG: 30, kcal: 2400, proteinG: 150 } },
  { slug: 'omnivoro-1600', patterns: [], targets: { carbsG: 155, fatG: 55, fiberG: 25, kcal: 1600, proteinG: 115 } },
  { slug: 'vegetariano-2000', patterns: ['vegetarian'], targets: { carbsG: 230, fatG: 70, fiberG: 32, kcal: 2000, proteinG: 115 } },
  { slug: 'sin-lactosa-2400', patterns: ['lactose_free'], targets: { carbsG: 250, fatG: 80, fiberG: 30, kcal: 2400, proteinG: 150 } },
  { slug: 'proteina-alta-3000', patterns: [], targets: { carbsG: 300, fatG: 90, fiberG: 35, kcal: 3000, proteinG: 190 } }
];

/**
 * What the request asks of every dish in it.
 *
 * It travels as `swapWish`, a field the prompt context already has, whose
 * rendered line ends *"Every dish proposed must satisfy that"* — so the sentence
 * goes through the prompt the service builds rather than being stapled to the
 * string it returns.
 *
 * **Said plainly, because a log line will not say it**: `swapWish` is the field a
 * meal *swap* names its wish in, and this script is **repurposing** it to steer a
 * batch. The four strings it normally holds are ones this code writes, so nothing
 * a person typed is involved — that is `dishRequest`, a different field for
 * exactly that reason (`0100`, and `health-boundary.spec.ts`'s allowed-key list).
 * Anybody reading a gateway's log of this run, or this script later, should read
 * a wish of the form "cooked in an air fryer: …" as **this batch's instruction**
 * and never as something a user asked for.
 *
 * It says three things, and the third is the one that matters: name the
 * appliance, build the method around it with no alternative offered (a dish that
 * offers a choice declares neither — `0067`), and **declare nothing the dish can
 * be made without**. Without that last clause the line that asks for an
 * appliance is a line that invites over-declaration, and an over-declared dish
 * is stored in the shared `recipes` table and withheld from every account whose
 * kitchen lacks the appliance it never really needed (`PoolPrompt`'s own
 * warning, pointed the other way).
 */
/**
 * Said to every request, after the appliance's own sentence, and both halves
 * were written from what the first probe came back with rather than guessed at.
 *
 * `google/gemma-4-31b-it`, asked for three air-fryer lunches, returned one that
 * **cooked rice in the air fryer basket with twice its volume of water** — a
 * machine that blows hot air asked to boil — and two that boiled rice or soaked
 * beans on a hob while declaring only `air_fryer`. The first is a dish nobody
 * can cook; the second is a dish whose declaration is short by an appliance,
 * which `0102` reads as "needs nothing" for the hob and is the under-declaration
 * `PoolPrompt`'s own warning is about, pointed the other way.
 *
 * So the line says what the machine cannot do, and that a hob step is a hob
 * declaration. Both are checked again on the way out (`check`, and the advisory
 * `hobWithoutStovetop` beside it) rather than trusted to the model.
 */
const WISH_TAIL =
  '. Ask the appliance only for what it can really do — it does not boil water or simmer in liquid unless that is what the machine is for. If any step uses a hob, a pot, a pan or boiling water, the dish needs the hob too and must list "stovetop" in equipment beside the other. Declare nothing the dish can be made without';

const WISH = {
  air_fryer:
    'cooked in an air fryer: design the dish around the air fryer, let no step offer an oven or a pan as an alternative, and list "air_fryer" in equipment',
  blender:
    'blended: design the dish around a blender or food processor — a cream, a cold soup, a purée, a batter — let no step offer a fork or a mortar as an alternative, and list "blender" in equipment',
  grill:
    'grilled over fire: design the dish around a barbecue or a ridged grill, let no step offer a frying pan as an alternative, and list "grill" in equipment',
  microwave:
    'cooked in a microwave: design the dish around the microwave, let no step offer a hob or an oven as an alternative, and list "microwave" in equipment',
  oven: 'baked: design the dish around the oven, let no step offer an air fryer or a pan as an alternative, and list "oven" in equipment',
  pressure_cooker:
    'cooked in a pressure cooker: design the dish around it — a stew, pulses from dry, a stock, a braise — let no step offer an ordinary pot as an alternative, and list "pressure_cooker" in equipment',
  rice_cooker:
    'cooked in a rice cooker: design the dish around it, with the rice and everything that cooks with it going into the machine, let no step offer a pot as an alternative, and list "rice_cooker" in equipment',
  slow_cooker:
    'cooked in a slow cooker: design the dish around a long unattended braise, let no step offer a pot or an oven as an alternative, and list "slow_cooker" in equipment',
  steamer:
    'steamed: design the dish around a steamer basket — fish, dumplings, delicate vegetables — let no step offer a pot of boiling water as an alternative, and list "steamer" in equipment'
};

/** Every appliance outside the default kitchen but the one being drafted for, so a draft cannot need two machines nobody has. */
function kitchenFor(appliance) {
  return Object.fromEntries(
    APPLIANCES.map(name => [name, name === appliance ? 'prefers' : DEFAULT_KITCHEN[name] === 'has' ? 'has' : 'missing'])
  );
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    check: null,
    concurrency: 3,
    /*
     * Slugs to leave out of a merge, comma-separated — the review's own verdict.
     *
     * A dish here broke **no gate**: `check` passed all of them. It is struck
     * because a person read it and said no — an appliance declared that the dish
     * never touches, an appliance key left in prose somebody will read, a dish
     * that is another dish with one adjective changed. That is the review the
     * owner asked for, and it belongs in a flag rather than in a hand-edited
     * file, so the file stays something the machinery emitted and the removals
     * stay a list somebody can read back.
     */
    exclude: '',
    // Sidecars of two runs, joined into one file — so a cell drafted in a second
    // run (the oven's, after the lead ruled on it) lands in the same file the
    // owner loads, written by the one emitter rather than by a cat.
    merge: null,
    locale: 'es-ES',
    maxUsd: 2,
    month: new Date().getUTCMonth() + 1,
    only: null,
    out: 'docs/local/021-equipment-batch.sql',
    passes: 10,
    plan: false,
    // Appliances to leave out of this run, comma-separated — the oven, while the
    // lead decides whether its snack cells are worth what they cost the
    // measurement they would be judged by (see the hand-back).
    skip: '',
    target: 12,
    yes: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    switch (flag) {
      case '--check':
      case '--merge':
        options[flag.slice(2)] = value;
        index += 1;
        break;
      case '--concurrency':
      case '--max-usd':
      case '--month':
      case '--passes':
      case '--target': {
        const number = Number(value);

        if (!Number.isFinite(number) || number <= 0) {
          fail(`${flag} wants a positive number`);
        }

        options[flag === '--max-usd' ? 'maxUsd' : flag.slice(2)] = number;
        index += 1;
        break;
      }
      case '--exclude':
      case '--locale':
      case '--only':
      case '--out':
      case '--skip':
        options[flag.slice(2)] = value;
        index += 1;
        break;
      case '--plan':
        options.plan = true;
        break;
      case '--yes':
        options.yes = true;
        break;
      default:
        fail(`unknown argument ${flag}`);
    }
  }

  return options;
}

function fail(message) {
  console.error(`draft-equipment-batch: ${message}`);
  process.exit(2);
}

/** The cells this run covers, as `--only` narrows them: an appliance, or `appliance:slot`. */
function cellsFor(options) {
  const [appliance, slot] = (options.only ?? '').split(':');
  const skipped = new Set(options.skip.split(',').filter(Boolean));
  const cells = [];

  for (const row of CELLS) {
    if ((appliance && row.appliance !== appliance) || skipped.has(row.appliance)) {
      continue;
    }

    for (const name of row.slots) {
      if (slot && name !== slot) {
        continue;
      }

      const held = HELD[row.appliance]?.[name] ?? 0;
      const want = Math.max(0, options.target - held);

      if (want > 0) {
        cells.push({ appliance: row.appliance, held, slot: name, want, why: row.why });
      }
    }
  }

  if (cells.length === 0) {
    fail(`--only ${options.only} matches no cell`);
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Reading the library — one read-only transaction, closed before any model call
// ---------------------------------------------------------------------------

async function readLibrary(options) {
  assertNotProduction();

  const require = createRequire(pathToFileURL(join(ROOT, 'apps/api/package.json')).href);
  const databaseModule = require('database');
  const originalDatabase = databaseModule.database;
  const pooled = originalDatabase();
  let read;

  try {
    await pooled.transaction(
      async tx => {
        databaseModule.database = () => tx;

        try {
          const context = await RecipeController.nobodysContext();
          const allergenIdsByKey = new Map((await SafetyController.listAllergens()).map(allergen => [allergen.key, allergen.id]));
          const ingredients = [...context.catalogue.values()];
          const briefs = [];

          for (const brief of BRIEFS) {
            const preferences = resolvePreferences({
              allergenIdsByKey,
              dietaryPatterns: brief.patterns,
              dislikedLabels: [],
              ingredients,
              maxMinutesPerDish: null
            });
            // eslint-disable-next-line no-await-in-loop -- one brief at a time inside one transaction.
            const usage = await RecipeController.libraryUsage(MEAL_SLOTS, {
              ...context,
              dietaryPatterns: brief.patterns,
              locale: options.locale,
              preferences
            });

            briefs.push({ ...brief, preferences, usage });
          }

          read = { allergenIdsByKey, briefs, catalogue: context.catalogue, safety: context.safety, slugs: await librarySlugs(tx, options.locale) };
        } finally {
          databaseModule.database = originalDatabase;
        }
      },
      { accessMode: 'read only' }
    );
  } finally {
    await databaseModule.closeDatabase();
  }

  return read;
}

/** Every slug the library already holds, so a draft that collides is dropped here rather than silently at load. */
async function librarySlugs(tx, locale) {
  const rows = await tx.execute(`select slug from recipes where locale = '${locale.replace(/'/g, "''")}'`);

  return new Set((rows.rows ?? rows).map(row => row.slug));
}

// ---------------------------------------------------------------------------
// Drafting
// ---------------------------------------------------------------------------

/** The share of a person's whole day each slot carries, as `PoolPrompt` computes it from the default shape. */
const SHARES = weightsFor(DEFAULT_MEAL_SHAPE);

/** Dishes one pass asks for: `PoolBuilder`'s own `DISHES_PER_REQUEST`, so a pass is one request and one brief. */
const PER_PASS = 3;

function promptFor(brief, appliance, options) {
  return {
    avoidNames: [],
    budget: null,
    cookingFrequency: null,
    // Left unset on purpose: a cooking time would refuse the slow cooker's own
    // dishes before they were written. What a limit costs them is a finding,
    // not something to hide by never drafting them.
    cookingTimeMinutes: null,
    cuisines: [],
    dayShape: null,
    dietaryPatterns: brief.patterns,
    dislikedNames: [],
    goal: null,
    likedFoods: [],
    lovedNames: [],
    month: options.month,
    slotShares: SHARES,
    swapWish: WISH[appliance] + WISH_TAIL,
    targets: brief.targets
  };
}

/**
 * One cell: ask until it has `want` dishes that declare the appliance, or the
 * passes run out.
 *
 * **A pass asks for three dishes and no more**, which is `DISHES_PER_REQUEST`
 * and therefore one request, because a pass carries **one** brief. Asking for
 * all twelve at once is what the first version did, and it is how a cell that
 * fills quickly ends up drafted entirely inside a single brief — twelve
 * air-fryer lunches all omnivorous, which is the trap the plan's step 2 names.
 * One brief per pass, advanced every pass and offset per cell, is what spreads
 * them; it costs more requests and they are a tenth of a cent each.
 */
async function draftCell(cell, index, library, builder, options, spend, drafted) {
  const kept = [];
  const offTarget = [];
  let calls = 0;
  let pass = 0;

  while (kept.length < cell.want && pass < options.passes) {
    if (spend.usd >= options.maxUsd) {
      break;
    }

    const brief = library.briefs[(index + pass) % library.briefs.length];
    const context = {
      catalogue: library.catalogue,
      dietaryPatterns: brief.patterns,
      locale: options.locale,
      preferences: { ...brief.preferences, kitchen: kitchenFor(cell.appliance) },
      safety: library.safety
    };

    pass += 1;

    // eslint-disable-next-line no-await-in-loop -- a pass is told what the last one kept.
    const result = await builder.build({
      context,
      feature: 'plan',
      libraryUsage: brief.usage,
      needPerSlot: Math.min(cell.want, kept.length + PER_PASS),
      preferences: promptFor(brief, cell.appliance, options),
      reusable: kept,
      session: `p8-${cell.appliance}-${cell.slot}-${pass}`,
      slots: [cell.slot]
    });

    calls += result.metadata.calls;

    for (const call of result.metadata.aiCalls) {
      spend.usd += call.costUsd ?? 0;
      spend.uncosted += call.costUsd === null ? 1 : 0;
      spend.inputTokens += call.inputTokens ?? 0;
      spend.outputTokens += call.outputTokens ?? 0;
    }

    for (const dish of result.generated) {
      // Three places a slug can already exist, and the third was missed on the
      // first run: the library, this cell, and **another cell of the same run**.
      // Cells are drafted concurrently and `PoolBuilder`'s own `excludeSlugs`
      // only knows one build's accepted dishes, so a blender breakfast and a
      // blender mid-morning snack both came back as
      // `crema-energetica-de-mango-y-chia`. It cost nothing — the second insert
      // would have been skipped by `ON CONFLICT (slug) DO NOTHING` — but it made
      // the run's own count two dishes larger than the file could ever load,
      // which is the kind of quiet arithmetic error a batch should not ship with.
      if (library.slugs.has(dish.slug) || drafted.has(dish.slug)) {
        continue;
      }

      drafted.add(dish.slug);

      if (dish.equipment.includes(cell.appliance)) {
        kept.push({ ...dish, brief: brief.slug, cell: `${cell.appliance}:${cell.slot}` });
      } else {
        // What it declared *instead* — not only that it missed. The first run
        // counted these and could not say what they were, and the answer is the
        // whole diagnosis: a slow-cooker request whose off-target dishes all
        // declare `stovetop` is a hob stew written because the braise was
        // refused, which is a different problem from one that declares nothing.
        offTarget.push(dish.equipment.join('+') || 'none');
      }
    }

    console.log(
      `  ${cell.appliance} ${cell.slot} pass ${pass}: ${result.generated.length} accepted, ${kept.length}/${cell.want} declaring, ${offTarget.length} off target, ${spend.usd.toFixed(4)} USD so far`
    );
  }

  const declared = {};

  for (const equipment of offTarget) {
    declared[equipment] = (declared[equipment] ?? 0) + 1;
  }

  return { ...cell, calls, kept, offTarget: offTarget.length, offTargetDeclared: declared, passes: pass };
}

/** The cells, `concurrency` at a time — network waits overlap, this machine's work does not. */
async function draftAll(cells, library, builder, options, spend) {
  const drafted = new Set();
  const queue = cells.map((cell, index) => ({ cell, index }));
  const done = [];

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, queue.length) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        // eslint-disable-next-line no-await-in-loop -- one worker, one cell at a time.
        done.push(await draftCell(next.cell, next.index, library, builder, options, spend, drafted));
      }
    })
  );

  return done.sort((left, right) => `${left.appliance}:${left.slot}`.localeCompare(`${right.appliance}:${right.slot}`));
}

// ---------------------------------------------------------------------------
// The gates, run again over the file — "the validator over the whole of it"
// ---------------------------------------------------------------------------

/**
 * Every claim the file makes, checked again from the dishes it holds.
 *
 * `PoolBuilder` ran these on the way in; this runs them on the way out, so the
 * thing the owner loads is the thing that was checked, and a dish edited by hand
 * between the two is caught.
 */
function check(dishes, library) {
  const problems = [];

  for (const dish of dishes) {
    const unknown = dish.ingredients.filter(item => !library.catalogue.has(item.slug)).map(item => item.slug);

    if (unknown.length > 0) {
      problems.push(`${dish.slug}: ingredient slugs outside the catalogue — ${unknown.join(', ')}`);
      continue;
    }

    const safety = dishSafety(dish.ingredients, library.catalogue, library.safety);

    if (safety.kind !== 'safe') {
      problems.push(`${dish.slug}: the allergy gate says ${safety.kind}`);
    }

    if (!hasUsableMethod(dish)) {
      problems.push(`${dish.slug}: not enough documented steps for a dish that is cooked`);
    }

    if (isOversized(dish, library.catalogue)) {
      problems.push(`${dish.slug}: one serving is past the ceiling (0070)`);
    }

    if (dish.slots.length === 0) {
      problems.push(`${dish.slug}: no meal`);
    }

    // A control character anywhere in the text is a load that stops half way: Postgres
    // refuses `\u0000` in JSON. The merge rewrites them; this is what says the file is safe.
    const texts = [dish.name, ...dish.steps.flatMap(step => [step.text, step.cue ?? ''])];

    // eslint-disable-next-line no-control-regex -- that is exactly what must not reach the file.
    if (texts.some(text => /[\u0000-\u001f]/.test(text))) {
      problems.push(`${dish.slug}: a control character in its text, which Postgres will refuse`);
    }

    const [appliance] = dish.cell.split(':');

    if (!dish.equipment.includes(appliance)) {
      problems.push(`${dish.slug}: drafted for ${appliance} and does not declare it`);
    }

    for (const name of dish.equipment) {
      if (!APPLIANCES.includes(name)) {
        problems.push(`${dish.slug}: "${name}" is not an appliance`);
      }
    }

    if (!withinEquipment(dish, kitchenFor(appliance))) {
      problems.push(`${dish.slug}: needs an appliance the kitchen it was drafted for does not have`);
    }
  }

  return problems;
}

/**
 * Dishes whose method reads as a hob and whose `equipment` does not say so —
 * **advisory, never a refusal**.
 *
 * It is the one claim in the file nothing can check: `withinEquipment` can only
 * refuse an appliance a dish *declares*, so a dish short by one is served to a
 * kitchen that cannot cook it and nothing anywhere says a word. The patterns are
 * phase 2's own Spanish list, read for the hob alone, and they over-report on
 * purpose — *"retira del fuego"* in a baked dish is a hit. It is what the owner's
 * sample is chosen from, not a gate.
 */
const HOB = /\b(hierv|herv[ií]|hirviendo|sart[eé]n|cazo|olla|a fuego|fuego medio|fuego fuerte|fuego lento|saltea|sofr[ií]|rehoga|dora en|en una cacerola)/i;

function hobWithoutStovetop(dishes) {
  return dishes
    .filter(dish => !dish.equipment.includes('stovetop') && dish.steps.some(step => HOB.test(step.text)))
    .map(dish => dish.slug);
}

/**
 * The appliance words a reader should never see, and their Spanish names.
 *
 * `cleanSteps` strips a leaked *field* name and a bare slug, and screens a step
 * whose text reads as English — but it screens English **stopwords**, and an
 * appliance is a noun, so *"tostar en la air_fryer"* and *"en el blender"* both
 * walk straight through it (`StepCleanup`, and `PoolBuilder` runs it on every
 * production generation, not only on this batch). The first is a field name on
 * somebody's plate; the second is cosmetic. Neither belongs in a shared library.
 *
 * **Only these.** An `APPLIANCES` key in any spelling, plus the English noun
 * `blender`. Not `oven`, `microwave`, `steamer` — and emphatically not `grill`,
 * which is a real Spanish word (*el grill del horno*): a blanket translation
 * table would introduce errors in the places it was meant to remove them.
 *
 * `article` carries the gender, because *"en el blender"* → *"en el batidora"*
 * is a worse sentence than the one it replaced.
 */
const APPLIANCE_WORDS = [
  { feminine: true, pattern: 'air[_ -]?fryer', spanish: 'freidora de aire' },
  { feminine: true, pattern: 'rice[_ -]?cooker', spanish: 'arrocera' },
  { feminine: true, pattern: 'pressure[_ -]?cooker', spanish: 'olla a presión' },
  { feminine: true, pattern: 'slow[_ -]?cooker', spanish: 'olla de cocción lenta' },
  { feminine: true, pattern: 'blender', spanish: 'batidora' },
  { feminine: false, pattern: 'stovetop', spanish: 'fuego' }
];

/**
 * Words that are Spanish but not **this locale's** Spanish, which the appliance
 * table above cannot hold because nothing about them is English.
 *
 * `estufa` is the only one, and it is here because in Spain an *estufa* is a
 * heater: *"regresa la crema a la estufa"* is a step that tells somebody to put
 * a saucepan on a radiator. Four of the second batch's drafts said it (2026-10-18).
 * Each is masculine in its replacement, so the contraction rules run the other
 * way round from the table above — *de la estufa* becomes *del fuego*.
 */
const REGIONAL_WORDS = [{ pattern: 'estufa', spanish: 'fuego' }];

/**
 * A control character is never part of a sentence, and the model drops one where a symbol
 * belonged — four steps of the second batch read `a 180\u0000C` and `a 200\u000c` for
 * *"a 180 °C"*. Postgres refuses the escape outright (`22P05`, *unsupported Unicode escape
 * sequence*), so the owner's load would have stopped half way through the file. A control
 * character straight after a number stood for the degrees: it becomes ` °C`, absorbing the C
 * if that survived. Any other one is replaced by a space, because what it stood for cannot be
 * guessed and two words must not be run together.
 */
function withoutControlCharacters(text) {
  return (
    text
      // eslint-disable-next-line no-control-regex -- a control character is what this removes.
      .replace(/(\d)[\u0000-\u001f]+(C)?(?!\p{L})/gu, '$1 °C')
      // eslint-disable-next-line no-control-regex -- and the same for every other one.
      .replace(/[\u0000-\u001f]+/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim()
  );
}

/** One step's text with every appliance word in Spanish, articles and contractions agreeing. */
function inSpanish(text) {
  // The model sometimes glosses the enum for itself — "sobre la cocina (stovetop)" — and a
  // rewrite of the word alone leaves the reader "sobre la cocina (fuego)". The sentence says
  // it already, so the gloss goes.
  let fixed = withoutControlCharacters(text).replace(
    new RegExp(`\\s*\\((?:${[...APPLIANCE_WORDS, ...REGIONAL_WORDS].flatMap(({ pattern, spanish }) => [pattern, spanish]).join('|')})\\)`, 'gi'),
    ''
  );

  for (const { feminine, pattern, spanish } of APPLIANCE_WORDS) {
    fixed = fixed
      .replace(new RegExp(`\\bdel\\s+${pattern}\\b`, 'gi'), feminine ? `de la ${spanish}` : `del ${spanish}`)
      .replace(new RegExp(`\\bal\\s+${pattern}\\b`, 'gi'), feminine ? `a la ${spanish}` : `al ${spanish}`)
      .replace(new RegExp(`\\b(?:el|la|los|las|un|una|unos|unas)\\s+${pattern}\\b`, 'gi'), feminine ? `la ${spanish}` : `el ${spanish}`)
      .replace(new RegExp(`\\b${pattern}\\b`, 'gi'), spanish);
  }

  for (const { pattern, spanish } of REGIONAL_WORDS) {
    fixed = fixed
      .replace(new RegExp(`\\bde\\s+la\\s+${pattern}\\b`, 'gi'), `del ${spanish}`)
      .replace(new RegExp(`\\ba\\s+la\\s+${pattern}\\b`, 'gi'), `al ${spanish}`)
      .replace(new RegExp(`\\b(?:el|la|los|las|un|una|unos|unas)\\s+${pattern}\\b`, 'gi'), `el ${spanish}`)
      .replace(new RegExp(`\\b${pattern}\\b`, 'gi'), spanish);
  }

  return fixed;
}

/**
 * The name rules — and the reason they exist at all is worth writing down.
 *
 * **No gate reads a name.** `check` passed all 171 dishes and said nothing about
 * them, because every gate in `PoolBuilder.judge` reads ingredients, slots,
 * minutes, equipment and steps. A name is the most-read text a dish has and it
 * is the one field nothing validates, so it takes a person — and a person
 * reading all 171 found an invented Spanish word, the same name twice under
 * *Bol* and *Bowl*, five names clipped to meaninglessness and a dozen spelling
 * and casing defects (the lead, 2026-10-17).
 *
 * Only these, each a normalisation rather than a rewrite. Nothing here invents
 * a name: an invented word cannot be repaired by rule and that dish was struck.
 */
const SPELLINGS = [
  // A missing accent is a misspelling in Spanish, not a variant.
  [/\bSesamo\b/g, 'Sésamo'],
  [/\bCurcuma\b/g, 'Cúrcuma'],
  [/\bSandwich\b/g, 'Sándwich'],
  // The reverse direction: *tempeh* carries no accent, and two other dishes spell it correctly.
  [/\bT[ée]mpeh\b/g, 'Tempeh'],
  // Agreement: *alubias* is plural, so the adjective is too.
  [/\balubias blanca\b/g, 'alubias blancas'],
  /*
   * The same class of agreement error, and found only because adding the accent
   * made it visible: *cúrcuma* is feminine, so *"al cúrcuma"* is wrong however it
   * is spelled. Beyond the letter of the instruction that asked for the accent,
   * inside its reason — and flagged to the owner, who is the Spanish speaker and
   * may overrule the wording.
   */
  [/\bal C[úu]rcuma\b/g, 'a la Cúrcuma']
];

/**
 * Spanish title case keeps these lower unless they open the name — the house
 * style of the other ~150 names in the batch, which is what the minority is
 * normalised to.
 */
const MINOR_WORDS = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'o', 'para', 'sin', 'su', 'y']);

/** `PoolBuilder.slugify`, so a renamed dish's slug is the one that function would have produced. */
function slugOf(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140);
}

/**
 * One name, normalised.
 *
 * The trailing *"al Aire"* is the same clipping `inSpanish` fixed inside the
 * steps: five air-fryer dishes whose method says *"en la freidora de aire"* lost
 * the appliance halfway through their own title, and *"Tostas Crujientes de Pavo
 * y Pera al Aire"* means nothing in Spanish. It is only ever applied to a dish
 * that **declares** `air_fryer`, so the rule cannot invent an appliance.
 *
 * *Bowl*, *Smoothie Bowl*, *Buda Bowl* and *al Air Fryer* are deliberately left
 * alone: ordinary usage in Spain, and a rule that "corrected" them would be the
 * naming-convention mistake this batch already made once.
 */
function tidyName(name, equipment) {
  let fixed = equipment.includes('air_fryer') ? name.replace(/\s+al\s+Aire\s*$/i, ' en Freidora de Aire') : name;

  for (const [pattern, replacement] of SPELLINGS) {
    fixed = fixed.replace(pattern, replacement);
  }

  // Capitalise the first letter of every word but the minor ones, and never
  // lower an existing capital — "Brócoli" stays, "Air Fryer" stays, "bacalao"
  // becomes "Bacalao".
  return fixed
    .split(/(\s+)/)
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : // After a hyphen too, so *pak-choi* reads *Pak-Choi* and matches the
          // *Pak Choi* another dish in the batch already writes.
          word.replace(/(^|-)(\p{Ll})/gu, (_match, before, first) => `${before}${first.toUpperCase()}`)
    )
    .join('');
}

/**
 * A pot or a pan named in a step is a hob the dish cannot be cooked without.
 *
 * `WISH_TAIL` asks the model for exactly this and it missed once:
 * `buda-bowl-de-tofu-y-edamame-en-arrocera` declares `rice_cooker` alone and
 * step 2 is *"saltearlos en una sartén"*. **Under-declaring is the dangerous
 * direction** — over-declaring withholds a dish, under-declaring hands somebody
 * a dish their kitchen cannot cook — so the appliance a step names is added.
 *
 * Deliberately **not** the word *fuego*, which is what the advisory heuristic
 * trips on: a grill dish's *"a fuego medio-alto"* is the grill's own heat, and
 * five of this batch's seven flags were that false positive. A *sartén*, a
 * *cazo*, an *olla* or a *cacerola* is a vessel and leaves no such doubt.
 */
const HOB_VESSEL = /\b(sart[eé]n|cazo|cacerola|olla)\b/i;

function withHobItNames(dish) {
  if (dish.equipment.includes('stovetop') || !dish.steps.some(step => HOB_VESSEL.test(step.text))) {
    return dish;
  }

  // Never "olla a presión" or "olla de cocción lenta" read as a plain pot.
  if (dish.steps.every(step => !HOB_VESSEL.test(step.text.replace(/olla (a presi[oó]n|r[aá]pida|de cocci[oó]n lenta|lenta)/gi, '')))) {
    return dish;
  }

  return { ...dish, equipment: [...dish.equipment, 'stovetop'] };
}

/** What the batch is made of, so the macro spread is reported rather than hoped for. */
function spread(dishes, catalogue) {
  const byBrief = new Map();
  const byGroup = new Map();
  const perServing = [];

  for (const dish of dishes) {
    byBrief.set(dish.brief, (byBrief.get(dish.brief) ?? 0) + 1);

    for (const group of dishGroups(dish)) {
      byGroup.set(group, (byGroup.get(group) ?? 0) + 1);
    }

    const composed = composePerServing(dish, catalogue);

    if (composed.ok) {
      perServing.push(composed.macros);
    }
  }

  const stat = key => {
    const values = perServing.map(row => row[key]).sort((left, right) => left - right);

    return values.length === 0
      ? { max: 0, median: 0, min: 0 }
      : { max: Math.round(values.at(-1)), median: Math.round(values[Math.floor(values.length / 2)]), min: Math.round(values[0]) };
  };

  return {
    byBrief: Object.fromEntries([...byBrief].sort()),
    byGroup: Object.fromEntries([...byGroup].sort()),
    hobWithoutStovetop: hobWithoutStovetop(dishes),
    perServing: { carbsG: stat('carbsG'), fatG: stat('fatG'), kcal: stat('kcal'), proteinG: stat('proteinG') },
    withTimeLimit: dishes.filter(dish => withinTime(dish, 30)).length
  };
}

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

const quote = value => `'${String(value).replace(/'/g, "''")}'`;

/**
 * The file, shaped as `docs/local/nutria-seed-500.sql` is: one transaction, a
 * missing ingredient slug aborting the whole load before a row is written, and a
 * dish whose slug already exists skipped so a re-run changes nothing.
 *
 * **With `equipment`, which that file has no column for** — it was written a
 * month before the column existed, and copying its column list would load every
 * dish declaring nothing, which `0102` reads as a pan and this phase as a
 * failure.
 */
function toSql(dishes, locale, librarySize) {
  const slugs = [...new Set(dishes.flatMap(dish => dish.ingredients.map(item => item.slug)))].sort();
  const lines = [
    `-- NutrIA equipment batch: ${dishes.length} dishes, locale ${locale}, source seed, prompt ${PROMPT_VERSION}.`,
    '-- Project 021 — the appliances a person may prefer, given dishes to offer them.',
    '-- Every dish declares its own `equipment` (0102): the model wrote the field, nothing was inferred from prose.',
    `-- Expect ${dishes.length} new rows. A dish whose slug already exists is SKIPPED IN SILENCE (ON CONFLICT (slug) DO`,
    '-- NOTHING), and its ingredients with it, since they ride on the insert’s RETURNING. So the two SELECTs below the',
    '-- ingredient check list what is already there before anything is written, and the one at the end counts what is',
    '-- there after: a count short of the number above is a collision, not a failure, and those queries say which.',
    `-- Drafted against a development library of ${librarySize.toLocaleString('en-GB')} dishes, so a slug production grew on its own may collide.`,
    "-- source is 'seed', as the five hundred are: a drafted batch validated and loaded by hand, which is what the admin",
    "-- catalogue counts that bucket as. 'ai' is the library's own growth while serving somebody (0080); this is not that.",
    '-- One transaction. Re-running changes nothing.',
    '-- Ingredients are found by catalogue slug; if any is missing, the whole load aborts and nothing is written.',
    `-- By cell: ${[...new Set(dishes.map(dish => dish.cell))].sort().map(cell => `${cell} ${dishes.filter(dish => dish.cell === cell).length}`).join(', ')}`,
    'BEGIN;',
    'DO $$ DECLARE missing text; BEGIN',
    `  SELECT string_agg(s, ', ') INTO missing FROM unnest(ARRAY[${slugs.map(quote).join(',')}]) AS s`,
    '    WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE i.slug = s);',
    "  IF missing IS NOT NULL THEN RAISE EXCEPTION 'missing ingredient slugs: %', missing; END IF;",
    'END $$;',
    // Drafted against the development library counted above; production's grew
    // from real plans and holds slugs this machine has never seen. A collision
    // is therefore possible, and `ON CONFLICT (slug) DO NOTHING` **says nothing
    // about it** — the dish is skipped, its ingredient insert writes nothing
    // either (the CTE returns no row), and the load reports a smaller count with
    // no hint as to why. So it is asked out loud before anything is written.
    `SELECT ${dishes.length} AS dishes_this_file_inserts_if_nothing_collides;`,
    `SELECT slug AS already_present_and_will_be_skipped FROM recipes WHERE slug IN (${dishes.map(dish => quote(dish.slug)).join(',')}) ORDER BY slug;`
  ];

  for (const dish of dishes) {
    const steps = dish.steps.map(step => ({ ...(step.cue ? { cue: step.cue } : {}), ...(step.minutes ? { minutes: step.minutes } : {}), text: step.text }));
    const items = [...dish.ingredients].sort((left, right) => left.slug.localeCompare(right.slug));

    lines.push(
      `-- ${dish.cell} (${dish.brief})`,
      'WITH r AS (INSERT INTO recipes (cook_minutes, created_by, cuisine, difficulty, equipment, instructions, locale, meal_slots, name, prep_minutes, servings, slug, source, steps_version)',
      `  VALUES (${dish.cookMinutes}, NULL, ${dish.cuisine === null ? 'NULL' : quote(dish.cuisine)}, ${quote(dish.difficulty)}, ARRAY[${dish.equipment.map(quote).join(',')}]::text[], ${quote(JSON.stringify(steps))}::jsonb, ${quote(locale)}, ARRAY[${dish.slots.map(quote).join(',')}]::text[], ${quote(dish.name)}, ${dish.prepMinutes}, ${dish.servings}, ${quote(dish.slug)}, 'seed', ${quote(PROMPT_VERSION)})`,
      '  ON CONFLICT (slug) DO NOTHING RETURNING id)',
      'INSERT INTO recipe_ingredients (grams, ingredient_id, quantity, recipe_id, unit)',
      `SELECT v.grams, i.id, v.grams, r.id, 'g' FROM r, (VALUES ${items.map(item => `(${Math.round(item.grams)}, ${quote(item.slug)})`).join(', ')}) AS v(grams, slug) JOIN ingredients i ON i.slug = v.slug;`
    );
  }

  lines.push(
    `SELECT count(*) AS equipment_batch_now FROM recipes WHERE slug IN (${dishes.map(dish => quote(dish.slug)).join(',')});`,
    'COMMIT;',
    ''
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.check) {
    const sidecar = options.check.replace(/\.sql$/, '.json');
    const dishes = JSON.parse(readFileSync(join(ROOT, sidecar), 'utf8')).dishes;
    const sql = readFileSync(join(ROOT, options.check), 'utf8');
    const library = await readLibrary(options);
    const problems = check(dishes, library);

    for (const dish of dishes) {
      if (!sql.includes(`'${dish.slug.replace(/'/g, "''")}'`)) {
        problems.push(`${dish.slug}: in the sidecar and not in the file`);
      }
    }

    console.log(`${dishes.length} dishes checked against every gate; ${problems.length} problem(s).`);
    problems.forEach(problem => console.log(`  ${problem}`));
    console.log(JSON.stringify(spread(dishes, library.catalogue), null, 2));

    process.exit(problems.length === 0 ? 0 : 1);
  }

  if (options.merge) {
    const parts = options.merge.split(',').map(path => JSON.parse(readFileSync(join(ROOT, path), 'utf8')));
    const library = await readLibrary(options);
    const seen = new Set();
    const struck = new Set(options.exclude.split(',').filter(Boolean));
    const kept = parts
      .flatMap(part => part.dishes)
      .filter(dish => !struck.has(dish.slug) && !seen.has(dish.slug) && seen.add(dish.slug));

    // Two rules applied on the way out, both deterministic, both printed in full
    // so the list is evidence rather than a claim: an appliance word in English
    // becomes its Spanish name, and a dish that names a pot or a pan declares
    // the hob it needs. Nothing here writes a sentence; both only rewrite what
    // the model already wrote, by a rule a reader can check.
    const changes = [];
    const dishes = kept.map(dish => {
      const steps = dish.steps.map(step => {
        const text = inSpanish(step.text);
        const cue = step.cue === undefined ? undefined : inSpanish(step.cue);

        if (text !== step.text || cue !== step.cue) {
          changes.push({ after: text, before: step.text, kind: 'word', slug: dish.slug });
        }

        return { ...step, cue, text };
      });
      const withHob = withHobItNames({ ...dish, steps });

      if (withHob.equipment.length !== dish.equipment.length) {
        changes.push({ after: withHob.equipment.join('+'), before: dish.equipment.join('+'), kind: 'equipment', slug: dish.slug });
      }

      const name = tidyName(withHob.name, withHob.equipment);

      if (name === withHob.name) {
        return withHob;
      }

      // The slug follows the name. Nothing is loaded yet, so a slug is still
      // free to move — once the owner has run this file it never is again.
      const slug = slugOf(name);

      changes.push({ after: `${name}  [${slug}]`, before: `${withHob.name}  [${withHob.slug}]`, kind: 'name', slug: withHob.slug });

      return { ...withHob, name, slug };
    });

    // A renamed dish's slug is a new slug, and it has to be as unique as the one
    // it replaced — against the library and against the rest of the batch.
    const slugs = dishes.map(dish => dish.slug);

    for (const [index, slug] of slugs.entries()) {
      if (slugs.indexOf(slug) !== index) {
        fail(`renaming produced two dishes with the slug ${slug}`);
      }

      if (library.slugs.has(slug)) {
        fail(`renaming produced ${slug}, which the library already holds`);
      }
    }

    console.log(`${changes.length} rule-applied change(s):`);

    for (const change of changes) {
      console.log(`  [${change.kind}] ${change.slug}`);
      console.log(`    before: ${change.before}`);
      console.log(`    after:  ${change.after}`);
    }


    for (const slug of struck) {
      if (!parts.some(part => part.dishes.some(dish => dish.slug === slug))) {
        fail(`--exclude names ${slug}, which is in none of the sidecars`);
      }
    }
    const problems = check(dishes, library);
    const spend = parts.reduce(
      (sum, part) => ({
        inputTokens: sum.inputTokens + part.spend.inputTokens,
        outputTokens: sum.outputTokens + part.spend.outputTokens,
        uncosted: sum.uncosted + part.spend.uncosted,
        usd: sum.usd + part.spend.usd
      }),
      { inputTokens: 0, outputTokens: 0, uncosted: 0, usd: 0 }
    );

    writeFileSync(join(ROOT, options.out), toSql(dishes, options.locale, library.slugs.size));
    writeFileSync(
      join(ROOT, options.out.replace(/\.sql$/, '.json')),
      `${JSON.stringify(
        {
          cells: parts.flatMap(part => part.cells),
          dishes,
          locale: options.locale,
          model: parts[0].model,
          promptVersion: parts[0].promptVersion,
          spend,
          spread: spread(dishes, library.catalogue)
        },
        null,
        2
      )}\n`
    );

    console.log(`${dishes.length} dishes merged into ${options.out}; ${problems.length} problem(s) from the gates run again.`);
    problems.forEach(problem => console.log(`  ${problem}`));
    console.log(`spend ${spend.usd.toFixed(4)} USD over both runs`);
    console.log(JSON.stringify(spread(dishes, library.catalogue), null, 2));

    process.exit(problems.length === 0 ? 0 : 1);
  }

  const cells = cellsFor(options);
  const wanted = cells.reduce((sum, cell) => sum + cell.want, 0);

  console.log(`${cells.length} cells, ${wanted} dishes wanted, at most ${options.passes} passes each:`);
  cells.forEach(cell => console.log(`  ${cell.appliance} ${cell.slot}: ${cell.held} held, ${cell.want} wanted — ${cell.why}`));

  const env = validateEnv(process.env);

  console.log(`\nprovider ${env.AI_PROVIDER}, model ${env.AI_MODEL}, ceiling ${options.maxUsd} USD`);

  if (options.plan || !options.yes) {
    console.log('\n--plan, or no --yes: nothing was called.');
    process.exit(0);
  }

  if (env.AI_PROVIDER === 'stub') {
    fail('AI_PROVIDER is "stub" — this run needs a real provider, and a stub would write nothing');
  }

  const library = await readLibrary(options);

  console.log(`library: ${library.slugs.size} dishes in ${options.locale}, ${library.catalogue.size} catalogue rows\n`);

  const client = new StructuredAiClient(resolveModel(env), resolveCallSettings(env), providerCredentials(env));
  const builder = new PoolBuilder(client, 240_000, resolveOutputCap(env));
  const spend = { inputTokens: 0, outputTokens: 0, uncosted: 0, usd: 0 };
  const started = Date.now();
  const done = await draftAll(cells, library, builder, options, spend);
  const dishes = done.flatMap(cell => cell.kept);
  const problems = check(dishes, library);

  writeFileSync(join(ROOT, options.out), toSql(dishes, options.locale, library.slugs.size));
  writeFileSync(
    join(ROOT, options.out.replace(/\.sql$/, '.json')),
    `${JSON.stringify(
      {
        cells: done.map(({ kept, ...rest }) => ({ ...rest, kept: kept.length })),
        dishes,
        locale: options.locale,
        model: env.AI_MODEL,
        promptVersion: PROMPT_VERSION,
        spend,
        spread: spread(dishes, library.catalogue)
      },
      null,
      2
    )}\n`
  );

  console.log(`\n${dishes.length} dishes in ${Math.round((Date.now() - started) / 1000)} s, written to ${options.out}`);
  console.log(
    `spend ${spend.usd.toFixed(4)} USD (${spend.inputTokens} in / ${spend.outputTokens} out tokens, ${spend.uncosted} call(s) with no cost reported)`
  );

  for (const cell of done) {
    const short = cell.kept.length < cell.want ? `  SHORT by ${cell.want - cell.kept.length}` : '';

    console.log(`  ${cell.appliance} ${cell.slot}: ${cell.kept.length}/${cell.want} in ${cell.passes} pass(es), ${cell.offTarget} off target${short}`);
  }

  console.log(`\n${problems.length} problem(s) from the gates run again over the file:`);
  problems.forEach(problem => console.log(`  ${problem}`));
  console.log(JSON.stringify(spread(dishes, library.catalogue), null, 2));

  process.exit(problems.length === 0 && dishes.length === wanted ? 0 : 1);
}

await main();
