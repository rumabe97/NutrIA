import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { isForeignCuisine } from 'core/domain/Preference';
import { database } from 'database';

import {
  completeOnboarding,
  createApp,
  deleteAccounts,
  dish,
  generateAndWait,
  httpServer,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';

/**
 * Traditional Spanish is a way of eating, enforced in code (`0077`, project 013).
 *
 * The scripted model proposes foreign dishes **on purpose**, one of each kind the
 * decision names — an excluded ingredient, a foreign cuisine, a foreign name — and
 * the library holds three more. The assertion is not that the prompt was obeyed
 * (the model is never shown the excluded rows); it is that no plate of the plan
 * carries any of them.
 *
 * A control account without the pattern proves the suite can fail: the same model
 * and library, and the foreign dishes do reach its plan. Without the control, a
 * plan with no foreign dish could mean "the scheduler never picked one".
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

/** The 157 exact catalogue slugs of `0077` § 1. Copied, so a slip in the product's list is not copied with it. */
const EXCLUDED_SLUGS: readonly string[] = [
  'aceite-de-coco',
  'aceite-de-sesamo',
  'agua-de-coco',
  'alga-kombu',
  'alga-nori',
  'alga-wakame',
  'alubias-negras-cocidas',
  'amaranto',
  'arroz-jazmin-crudo',
  'arroz-para-sushi',
  'arroz-salvaje-cocido',
  'arroz-salvaje-crudo',
  'arroz-tres-delicias-congelado',
  'azukis',
  'baba-ganoush',
  'bagel',
  'bebida-de-proteinas',
  'bebida-de-proteinas-vegetal',
  'brotes-de-alfalfa',
  'brotes-de-soja',
  'bulgur-cocido',
  'bulgur-crudo',
  'caldo-dashi',
  'chile-chipotle-seco',
  'chutney-de-mango',
  'cinco-especias-chinas',
  'coco-fresco',
  'col-china',
  'col-rizada',
  'crema-agria',
  'crema-de-anacardos',
  'crema-de-coco',
  'curry-en-polvo',
  'daikon',
  'edamame-cocido',
  'edamame-congelado',
  'espirulina',
  'fideos-de-arroz-cocidos',
  'fideos-de-arroz-secos',
  'fideos-de-cristal',
  'fideos-soba',
  'filete-de-panga-congelado',
  'freekeh',
  'frijoles-refritos',
  'garam-masala',
  'ghee',
  'gochujang',
  'guacamole',
  'hamburguesa-vegetal',
  'harina-de-trigo-sarraceno',
  'harissa',
  'heura',
  'hierba-limon',
  'hummus',
  'hummus-de-remolacha',
  'jackfruit',
  'jalapeno',
  'jengibre-en-polvo',
  'jengibre-fresco',
  'judia-mungo',
  'kimchi',
  'kombucha',
  'leche-de-almendra',
  'leche-de-avena',
  'leche-de-coco',
  'leche-de-coco-ligera',
  'leche-de-soja',
  'lentejas-rojas-cocidas',
  'levadura-nutricional',
  'lichi',
  'mango',
  'mango-congelado',
  'mantequilla-de-cacahuete',
  'maracuya',
  'mijo',
  'mijo-cocido',
  'miso',
  'nachos',
  'noodles-de-trigo',
  'noodles-udon',
  'nuggets-vegetales',
  'okra',
  'pak-choi',
  'pan-bao',
  'pan-de-pita',
  'pan-naan',
  'papaya',
  'papel-de-arroz',
  'pasta-de-curry-rojo',
  'pasta-de-curry-verde',
  'pate-vegetal',
  'pesto-vegano',
  'pitaya',
  'platano-macho',
  'proteina-de-guisante',
  'proteina-de-suero',
  'queso-cheddar',
  'queso-cottage',
  'queso-feta',
  'queso-halloumi',
  'queso-havarti',
  'queso-raclette',
  'queso-scamorza',
  'queso-vegano',
  'quinoa-cocida',
  'quinoa-cruda',
  'quinoa-hinchada',
  'ramen-instantaneo',
  'ras-el-hanout',
  'salchichas-vegetales',
  'salsa-agridulce',
  'salsa-barbacoa',
  'salsa-de-chile-dulce',
  'salsa-de-ostras',
  'salsa-de-pescado',
  'salsa-de-soja',
  'salsa-de-soja-baja-en-sal',
  'salsa-hoisin',
  'salsa-pico-de-gallo',
  'salsa-ponzu',
  'salsa-satay',
  'salsa-sriracha',
  'salsa-teriyaki',
  'sazonador-para-tacos',
  'seitan',
  'sesamo',
  'seta-shiitake',
  'sirope-de-agave',
  'sirope-de-arce',
  'sirope-de-datiles',
  'skyr',
  'soja-cocida',
  'soja-en-grano',
  'soja-texturizada',
  'sumac',
  'tahini',
  'tamari',
  'te-matcha',
  'tempeh',
  'tilapia',
  'tofu-ahumado',
  'tofu-firme',
  'tofu-sedoso',
  'tortilla-de-maiz',
  'tortilla-de-trigo',
  'tortitas-americanas',
  'tortitas-de-maiz',
  'trigo-sarraceno',
  'trigo-sarraceno-cocido',
  'tzatziki',
  'vinagre-de-arroz',
  'wasabi',
  'wrap-integral',
  'yogur-de-coco',
  'yogur-de-soja',
  'yuca',
  'zaatar'
];

/** `0077` § 3, as written there. */
const FOREIGN_NAME =
  /\b(?:curry|shakshuka|wok|poke|sushi|ramen|burrito|fajitas?|quesadilla|teriyaki|pad thai|falafel|tabul[eé]|nachos|hummus|guacamole|chipotle|tikka|masala|noodles?|bibimbap|kimchi)\b/i;

/** In every dish name this suite writes, so its recipes (shared by every account) can be found and removed. */
const MARK = 'e2e013x';

const ASIATIC = { cuisine: 'asiática' };

const ALLOWED = [
  dish('Yogur con fruta', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish(
    'Yogur y huevo',
    ['breakfast'],
    [
      { grams: 150, slug: SEEDED.yogur },
      { grams: 100, slug: SEEDED.huevo }
    ]
  ),
  dish(
    'Huevo con tomate',
    ['breakfast'],
    [
      { grams: 120, slug: SEEDED.huevo },
      { grams: 120, slug: SEEDED.tomate }
    ]
  ),
  dish('Yogur solo', ['breakfast'], [{ grams: 300, slug: SEEDED.yogur }]),
  dish(
    'Arroz con pollo',
    ['lunch'],
    [
      { grams: 220, slug: SEEDED.arroz },
      { grams: 180, slug: SEEDED.pollo }
    ]
  ),
  dish(
    'Lentejas con arroz',
    ['lunch'],
    [
      { grams: 250, slug: SEEDED.lentejas },
      { grams: 150, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Pollo con patata',
    ['lunch'],
    [
      { grams: 200, slug: SEEDED.pollo },
      { grams: 250, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Arroz con tomate',
    ['lunch'],
    [
      { grams: 260, slug: SEEDED.arroz },
      { grams: 150, slug: SEEDED.tomate }
    ]
  ),
  dish('Lentejas solas', ['lunch'], [{ grams: 350, slug: SEEDED.lentejas }]),
  dish(
    'Merluza con patata',
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 220, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Pollo con tomate',
    ['dinner'],
    [
      { grams: 170, slug: SEEDED.pollo },
      { grams: 200, slug: SEEDED.tomate }
    ]
  ),
  dish(
    'Merluza con arroz',
    ['dinner'],
    [
      { grams: 180, slug: SEEDED.merluza },
      { grams: 180, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Patata con huevo',
    ['dinner'],
    [
      { grams: 250, slug: SEEDED.patata },
      { grams: 110, slug: SEEDED.huevo }
    ]
  ),
  dish('Merluza sola', ['dinner'], [{ grams: 300, slug: SEEDED.merluza }])
];

/**
 * Foreign on exactly one count each, so a rule that is missing is the rule that
 * fails: tofu under a Spanish name and a "mediterranea" cuisine; allowed
 * ingredients under cuisine "asiática"; allowed ingredients under a "Wok" name.
 */
const FOREIGN = [
  dish(`Tofu salteado ${MARK}`, ['lunch', 'dinner'], [{ grams: 200, slug: 'tofu-firme' }]),
  dish(
    `Arroz con tofu ${MARK}`,
    ['lunch', 'dinner'],
    [
      { grams: 200, slug: SEEDED.arroz },
      { grams: 150, slug: 'tofu-firme' }
    ]
  ),
  dish(`Tortitas con tofu ${MARK}`, ['breakfast'], [{ grams: 150, slug: 'tofu-sedoso' }]),
  { ...dish(`Arroz con pollo y verdura ${MARK}`, ['lunch', 'dinner'], [{ grams: 250, slug: SEEDED.arroz }]), ...ASIATIC },
  { ...dish(`Pollo con patata y huevo ${MARK}`, ['lunch', 'dinner'], [{ grams: 250, slug: SEEDED.pollo }]), ...ASIATIC },
  { ...dish(`Huevos con yogur ${MARK}`, ['breakfast'], [{ grams: 250, slug: SEEDED.huevo }]), ...ASIATIC },
  dish(`Wok de pollo ${MARK}`, ['lunch', 'dinner'], [{ grams: 250, slug: SEEDED.pollo }]),
  dish(`Wok de merluza ${MARK}`, ['lunch', 'dinner'], [{ grams: 250, slug: SEEDED.merluza }]),
  dish(`Poke de huevo ${MARK}`, ['breakfast'], [{ grams: 250, slug: SEEDED.huevo }])
];

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/** A library dish, written on the table: what a model's earlier fortnight left behind. */
async function seedLibraryDish(slug: string, name: string, cuisine: string | null, slots: readonly string[], ingredientSlugs: readonly string[]) {
  const steps = JSON.stringify([
    { cue: 'hasta que el aceite brille', minutes: 1, text: 'Calentar el aceite en la sartén a fuego medio' },
    { minutes: 9, text: 'Añadir los ingredientes y cocinar, removiendo, hasta que estén hechos' }
  ]);
  const [recipe] = await sql()<{ id: string }>`
    insert into recipes (slug, name, cuisine, meal_slots, instructions, locale, source, cook_minutes, prep_minutes, servings, difficulty)
    values (${slug}, ${name}, ${cuisine}, ${slots as string[]}, ${steps}::jsonb, 'es-ES', 'seed', 10, 5, 1, 'easy')
    returning id`;

  for (const ingredientSlug of ingredientSlugs) {
    const added = await sql()<{ id: string }>`
      insert into recipe_ingredients (recipe_id, ingredient_id, grams, quantity, unit)
      select ${recipe.id}, id, 200, 200, 'g' from ingredients where slug = ${ingredientSlug}
      returning id`;

    if (added.length !== 1) {
      throw new Error(`The catalogue has no ingredient ${ingredientSlug}`);
    }
  }
}

type PlanRow = { cuisine: string | null; ingredientSlug: string; name: string };

/** Every recipe on every plate of every plan this account has, with every ingredient it holds. */
async function plates(userId: string): Promise<readonly PlanRow[]> {
  return sql()<PlanRow>`
    select r.name, r.cuisine, i.slug as "ingredientSlug"
    from meal_plans p
    join plan_days d on d.plan_id = p.id
    join meals m on m.plan_day_id = d.id
    join recipes r on r.id = m.recipe_id
    join recipe_ingredients ri on ri.recipe_id = r.id
    join ingredients i on i.id = ri.ingredient_id
    where p.user_id = ${userId}`;
}

function violations(rows: readonly PlanRow[]): readonly string[] {
  return rows.flatMap(row => [
    ...(EXCLUDED_SLUGS.includes(row.ingredientSlug) ? [`ingredient ${row.ingredientSlug} in "${row.name}"`] : []),
    ...(isForeignCuisine(row.cuisine) ? [`cuisine ${row.cuisine} in "${row.name}"`] : []),
    ...(FOREIGN_NAME.test(row.name) ? [`name "${row.name}"`] : [])
  ]);
}

describe('traditional Spanish, end to end', () => {
  let app: INestApplication;
  let spanish: Account;
  let control: Account;

  beforeAll(async () => {
    await seedLibraryDish(`${MARK}-tofu-con-arroz`, `Tofu con arroz ${MARK}`, 'mediterranea', ['lunch', 'dinner'], ['tofu-firme', SEEDED.arroz]);
    await seedLibraryDish(`${MARK}-sopa-de-soja`, `Sopa de salsa de soja ${MARK}`, null, ['lunch', 'dinner'], ['salsa-de-soja', SEEDED.pollo]);
    await seedLibraryDish(`${MARK}-pollo-asiatico`, `Pollo con arroz ${MARK}`, 'asiática', ['lunch', 'dinner'], [SEEDED.pollo, SEEDED.arroz]);
    await seedLibraryDish(`${MARK}-curry-de-pollo`, `Curry de pollo ${MARK}`, 'mediterranea', ['lunch', 'dinner'], [SEEDED.pollo, SEEDED.patata]);
    await seedLibraryDish(`${MARK}-desayuno-tofu`, `Desayuno de tofu ${MARK}`, 'americana', ['breakfast'], ['tofu-sedoso']);

    app = await createApp(new ScriptedAiClient([...FOREIGN, ...ALLOWED]));
    spanish = await register(app, `trad-spanish-${Date.now()}@e2e.invalid`);
    control = await register(app, `trad-control-${Date.now()}@e2e.invalid`);

    await completeOnboarding(app, spanish, [], [], false, ['traditional_spanish']);
    await completeOnboarding(app, control);
  }, 180_000);

  afterAll(async () => {
    // Accounts first: a meal holds its recipe, and refuses to let it go.
    await deleteAccounts(
      app,
      [spanish?.cookie, control?.cookie].filter((cookie): cookie is string => Boolean(cookie))
    );
    await sql()`delete from recipes where slug like ${`${MARK}-%`} or name like ${`%${MARK}%`}`;
    await app?.close();
  });

  it('stores the pattern and gives it back in the profile', async () => {
    const profile: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', spanish.cookie).expect(200);

    expect((profile.body as { dietaryPatterns: readonly string[] }).dietaryPatterns).toEqual(['traditional_spanish']);

    const other: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', control.cookie).expect(200);

    expect((other.body as { dietaryPatterns: readonly string[] }).dietaryPatterns).toEqual([]);
  });

  it('never puts an excluded ingredient, a foreign cuisine or a foreign name on a plate, however hard the model and the library push', async () => {
    const job = await generateAndWait(app, spanish, 180_000);

    expect(job.status).toBe('succeeded');

    const plan: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', spanish.cookie).expect(200);

    expect((plan.body as { days: readonly unknown[] }).days).toHaveLength(14);

    const rows = await plates(spanish.id);

    expect(rows.length).toBeGreaterThan(0);
    // Shaped so a failure names the offending plate and the rule it broke.
    expect(violations(rows)).toEqual([]);
  }, 200_000);

  it('does not let them onto the shopping list either', async () => {
    const listed: Response = await request(httpServer(app)).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', spanish.cookie).expect(200);
    const names = (listed.body as { items: readonly { name: string }[] }).items.map(item => item.name.toLowerCase());

    expect(names.length).toBeGreaterThan(0);
    expect(names.filter(name => name.includes('tofu') || name.includes('soja'))).toEqual([]);
  });

  it('is the suite that can fail: without the pattern the same model and library do reach a plan', async () => {
    const job = await generateAndWait(app, control, 180_000);

    expect(job.status).toBe('succeeded');

    // If this ever stops holding, the case above proves nothing: the foreign
    // dishes were never picked, so their absence says nothing about the rule.
    expect(violations(await plates(control.id)).length).toBeGreaterThan(0);
  }, 200_000);
});
