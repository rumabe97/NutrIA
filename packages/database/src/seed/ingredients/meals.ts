import type { IngredientSeed, MealEntry, MealSlot } from './types';

/**
 * Foods that belong only to some meals.
 *
 * An exception list, like `countries.ts`: a row absent from here belongs to
 * every meal, and a row named here belongs only to the meals it lists. A
 * meal's catalogue is the rows that are absent or name it, and a dish is
 * served only at the meals all of its ingredients share (`0062`). An empty
 * list would mean "every meal", which is what absence already says, so no
 * list here is empty (`meals.test.ts`).
 *
 * The question each row answers is the owner's: would somebody in Spain
 * actually eat this at that meal? "En las cenas poner cosas típicas de la
 * cena… no creo que mucha gente quiera cenar unas lentejas. Lo mismo para la
 * comida, desayuno, merienda." The rules, each one a group below:
 *
 * 1. Stewed or dry pulses — dry and cooked lentils, chickpeas, beans, dry
 *    broad beans, tinned pulse stews: lunch only.
 * 2. Light pulse forms — hummus, roasted chickpeas, chickpea flour, edamame,
 *    lupins, refried beans: every meal but breakfast.
 * 3. Raw meat and fish cuts, offal, fresh sausages and the meat analogues
 *    that stand in for them: lunch and dinner.
 * 4. Whole dishes — ready meals, tinned and packaged stews, soups and
 *    creams, frozen breaded and ready foods: lunch and dinner. A paella is
 *    lunch only; bomba rice, a cooking base, is lunch and dinner (owner,
 *    2026-09-25).
 * 5. Cooking bases — raw grains and pasta, stocks, cooking sauces, cooking
 *    cream and wine, breadcrumbs and batters, burger and hot dog buns, dough:
 *    lunch and dinner. Nobody has macaroni or a stock cube for breakfast.
 * 6. Cooking vegetables — the ones that are cooked before they are eaten
 *    (chard, cabbage, artichoke, squash, mushrooms…), fresh, frozen or
 *    tinned: lunch and dinner. Tender broad beans and peas are here, not in
 *    rule 1: "habitas con jamón" is a dinner.
 * 7. Tinned fish and seafood, cured sausages, olives, dips and savoury
 *    pastries: every meal but breakfast. A "bocadillo de atún" or of
 *    chorizo is a merienda; chorizo on the breakfast table is not.
 * 8. Breakfast and sweet foods — cereals, pastries, biscuits, jams and
 *    spreads, sweet toppings, flavoured yoghurts, juices, coffee, tea, cocoa,
 *    milkshakes, protein powders and drinks: breakfast and the snacks. Oats
 *    or jam at dinner is what this rule keeps out. Coffee and tea stop at
 *    the afternoon snack: no caffeine at supper (owner, 2026-09-25).
 * 9. Sweets, desserts, ice creams and salty snacks: the snacks only.
 * 10. Other drinks: where they are actually drunk. Soft drinks and alcohol-
 *     free beer at every meal but breakfast; alcohol-free wine at lunch and
 *     dinner; infusions at every meal but lunch.
 *
 * `supper` is a late snack after dinner, and gets the snacks' foods: every
 * list that names `afternoon_snack` also names `supper`, and no other list
 * does (PRD § Open questions; the test holds it) — except coffee and tea,
 * which stop at the afternoon snack.
 *
 * One row is in no meal at all, written `['none']` because an empty list
 * would mean every meal: the energy drink (owner, 2026-09-25: "fuera"). It
 * stays in the catalogue, so a recipe or a list that already names it still
 * resolves, and it is offered and served nowhere.
 *
 * Never here: staples — salt, oils, fats, spices, dried and fresh herbs,
 * garlic, onion, lemon, vinegars, sugar and sweeteners, flours and leavening
 * — and what sits at any table: water, eggs, bread, potato, fresh and
 * frozen fruit, salad leaves and salad vegetables (sweetcorn and fresh
 * peppers among them — a snack wrap uses both), cheese, milk and
 * plant drinks, plain yoghurt, tofu, nuts, seeds, dried fruit, cooked ham
 * and cold cuts, smoked salmon and trout, table sauces. A vegan or
 * vegetarian person is shown every plant protein at every meal whatever its
 * list says (`0062` § 4); that is applied where the lists are read, not
 * here, so the pulses carry the same list for everyone.
 */
const LUNCH: readonly MealSlot[] = ['lunch'];
const LUNCH_AND_DINNER: readonly MealSlot[] = ['lunch', 'dinner'];
const NOT_BREAKFAST: readonly MealSlot[] = ['morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];
const NOT_LUNCH: readonly MealSlot[] = ['breakfast', 'morning_snack', 'afternoon_snack', 'dinner', 'supper'];
const BREAKFAST_AND_SNACKS: readonly MealSlot[] = ['breakfast', 'morning_snack', 'afternoon_snack', 'supper'];
const SNACKS: readonly MealSlot[] = ['morning_snack', 'afternoon_snack', 'supper'];
const BREAKFAST_AND_DAY_SNACKS: readonly MealSlot[] = ['breakfast', 'morning_snack', 'afternoon_snack'];
const NO_MEAL: readonly MealEntry[] = ['none'];

type Group = { readonly slots: readonly MealEntry[]; readonly slugs: readonly string[] };

const GROUPS: readonly Group[] = [
  // 1. Stewed or dry pulses, and the tinned stews made of them: lunch only.
  {
    slots: LUNCH,
    slugs: [
      'alubias-blancas-cocidas',
      'alubias-blancas-secas',
      'alubias-con-verduras-en-lata',
      'alubias-negras-cocidas',
      'alubias-pintas-cocidas',
      'alubias-pintas-secas',
      'azukis',
      'cocido-madrileno-en-lata',
      'fabada-en-lata',
      'garbanzos-cocidos',
      'garbanzos-con-espinacas-en-lata',
      'garbanzos-secos',
      'guisantes-secos-partidos',
      'habas-secas',
      'judia-mungo',
      'judias-rojas-cocidas',
      'judiones',
      'lentejas-cocidas',
      'lentejas-con-chorizo-en-lata',
      'lentejas-rojas-cocidas',
      'lentejas-secas',
      'soja-cocida',
      'soja-en-grano'
    ]
  },
  // 2. Light pulse forms: a dip, a crunchy snack, a batter, a bean side —
  // every meal but breakfast. Pulse pasta is pasta, and follows rule 5.
  {
    slots: NOT_BREAKFAST,
    slugs: [
      'altramuces',
      'edamame-cocido',
      'edamame-congelado',
      'frijoles-refritos',
      'garbanzos-tostados',
      'harina-de-garbanzo',
      'hummus',
      'hummus-de-remolacha'
    ]
  },
  // 3. Raw meat, offal and fresh sausages: lunch and dinner.
  {
    slots: LUNCH_AND_DINNER,
    slugs: [
      'alitas-de-pollo',
      'butifarra',
      'cabrito',
      'carne-de-ciervo',
      'carne-picada-de-cerdo',
      'carne-picada-de-ternera',
      'carne-picada-mixta',
      'carrillera-de-cerdo',
      'carrillera-de-ternera',
      'chuleta-de-cerdo',
      'chuletas-de-cordero',
      'chuleton-de-ternera',
      'codillo-de-cerdo',
      'codorniz',
      'conejo',
      'confit-de-pato',
      'contramuslo-de-pollo',
      'cordero-picado',
      'costilla-de-ternera',
      'costillas-de-cerdo',
      'entrecot-de-ternera',
      'falda-de-ternera',
      'filete-de-ternera',
      'hamburguesa-de-ternera',
      'higado-de-pollo',
      'higado-de-ternera',
      'lomo-de-cerdo',
      'magret-de-pato',
      'morcilla',
      'morcillo-de-ternera',
      'muslo-de-pavo',
      'muslo-de-pollo',
      'paletilla-de-cordero',
      'panceta',
      'pavo',
      'pavo-picado',
      'pechuga-de-pavo',
      'pechuga-de-pollo',
      'perdiz',
      'pierna-de-cordero',
      'pollo-entero',
      'pollo-picado',
      'presa-iberica',
      'rabo-de-toro',
      'redondo-de-ternera',
      'salchichas-de-pollo',
      'salchichas-frescas',
      'secreto-de-cerdo',
      'solomillo-de-cerdo',
      'solomillo-de-ternera',
      'ternera-magra',
      'ternera-para-guisar'
    ]
  },
  // 3. Bacon is a cooking cut here, and a breakfast in an English kitchen.
  { slots: ['breakfast', 'lunch', 'dinner'], slugs: ['bacon'] },
  // 3. Raw fish and seafood, fresh or frozen: lunch and dinner.
  {
    slots: LUNCH_AND_DINNER,
    slugs: [
      'abadejo',
      'almeja',
      'anillas-de-calamar-congeladas',
      'atun-fresco',
      'bacaladilla',
      'bacalao-congelado',
      'bacalao-desalado',
      'bacalao-en-salazon',
      'bacalao-fresco',
      'berberechos',
      'besugo',
      'bogavante',
      'bonito',
      'boquerones',
      'caballa',
      'calamar',
      'cangrejo',
      'caracoles',
      'centollo',
      'chipirones',
      'cigalas',
      'congrio',
      'corvina',
      'dorada',
      'filete-de-merluza-congelado',
      'filete-de-panga-congelado',
      'fletan',
      'gallo',
      'gambas',
      'gambas-peladas-congeladas',
      'gambon',
      'gulas',
      'huevas-de-merluza',
      'jurel',
      'langostinos',
      'langostinos-congelados',
      'lenguado',
      'lubina',
      'mejillon',
      'mejillones-congelados',
      'merluza',
      'mero',
      'mix-de-marisco-congelado',
      'navajas',
      'ostras',
      'palometa',
      'perca',
      'pescadilla',
      'pez-espada',
      'pulpo-cocido',
      'pulpo-congelado',
      'pulpo-fresco',
      'rape',
      'raya',
      'rodaballo',
      'rosada',
      'salmon',
      'salmon-congelado',
      'salmonete',
      'sardina',
      'sepia',
      'sepia-congelada',
      'tilapia',
      'trucha',
      'vieiras',
      'zamburinas'
    ]
  },
  // 3. Meat analogues, where a meat cut would be. A vegan or vegetarian is
  // shown them everywhere (`0062` § 4); this is what an omnivore sees.
  {
    slots: LUNCH_AND_DINNER,
    slugs: ['hamburguesa-vegetal', 'heura', 'nuggets-vegetales', 'salchichas-vegetales', 'seitan', 'soja-texturizada', 'tempeh']
  },
  // 4. Spanish rice dishes are eaten at midday.
  { slots: LUNCH, slugs: ['paella-congelada'] },
  // Bomba rice is a cooking base like any raw grain: lunch and dinner.
  { slots: LUNCH_AND_DINNER, slugs: ['arroz-bomba-crudo'] },
  // 4. Whole dishes: ready meals, tinned and packaged stews, soups and creams,
  // frozen breaded and ready foods.
  {
    slots: LUNCH_AND_DINNER,
    slugs: [
      'albondigas-envasadas',
      'arroz-tres-delicias-congelado',
      'calamares-a-la-romana-congelados',
      'calamares-en-su-tinta',
      'callos-en-lata',
      'canelones-preparados',
      'crema-de-calabaza-envasada',
      'crema-de-champinones-envasada',
      'crema-de-verduras-envasada',
      'croquetas-de-jamon-congeladas',
      'croquetas-de-pollo-congeladas',
      'empanadillas-de-atun-congeladas',
      'ensalada-envasada',
      'ensaladilla-rusa-envasada',
      'espinacas-a-la-crema-congeladas',
      'flamenquines-congelados',
      'gambas-rebozadas-congeladas',
      'gazpacho-envasado',
      'lasana-preparada',
      'nuggets-de-pollo-congelados',
      'palitos-de-merluza-congelados',
      'pan-de-ajo-congelado',
      'patatas-fritas-congeladas',
      'patatas-gajo-congeladas',
      'pizza-cuatro-quesos-congelada',
      'pizza-fresca-refrigerada',
      'pizza-margarita-congelada',
      'pollo-asado-envasado',
      'pure-de-patatas-en-copos',
      'quiche-de-verduras',
      'ramen-instantaneo',
      'salmorejo-envasado',
      'san-jacobos-congelados',
      'sopa-de-fideos-envasada',
      'sopa-de-verduras-envasada'
    ]
  },
  // 5. Cooking bases: raw and cooked grains, pasta and noodles, stocks,
  // cooking sauces, cream and wine, breadcrumbs and batters, dough, buns.
  {
    slots: LUNCH_AND_DINNER,
    slugs: [
      'alga-kombu',
      'alga-nori',
      'alga-wakame',
      'arroz-basmati-cocido',
      'arroz-basmati-crudo',
      'arroz-blanco-cocido',
      'arroz-integral-cocido',
      'arroz-integral-crudo',
      'arroz-jazmin-crudo',
      'arroz-largo-crudo',
      'arroz-negro-crudo',
      'arroz-para-sushi',
      'arroz-salvaje-cocido',
      'arroz-salvaje-crudo',
      'arroz-vaporizado',
      'base-de-pizza-fresca',
      'bulgur-cocido',
      'bulgur-crudo',
      'caldo-dashi',
      'caldo-de-carne',
      'caldo-de-pescado',
      'caldo-de-pollo',
      'caldo-de-verduras',
      'cebada-cocida',
      'cebada-perlada',
      'chucrut',
      'concentrado-de-tomate',
      'cuscus-cocido',
      'cuscus-crudo',
      'espaguetis-secos',
      'espelta-cocida',
      'espelta-en-grano',
      'fideos-de-arroz-cocidos',
      'fideos-de-arroz-secos',
      'fideos-de-cristal',
      'fideos-finos',
      'fideos-soba',
      'freekeh',
      'gochujang',
      'harina-para-tempura',
      'harissa',
      'kimchi',
      'leche-de-coco',
      'leche-de-coco-ligera',
      'macarrones-secos',
      'masa-de-pizza',
      'mijo',
      'mijo-cocido',
      'miso',
      'mojo-picon',
      'mojo-verde',
      'nata-ligera',
      'nata-para-cocinar',
      'nata-vegetal-de-avena',
      'nata-vegetal-de-soja',
      'noodles-de-trigo',
      'noodles-udon',
      'noquis',
      'obleas-de-empanadillas',
      'pan-bao',
      'pan-de-hamburguesa',
      'pan-de-hamburguesa-integral',
      'pan-de-perrito',
      'pan-naan',
      'pan-rallado',
      'pan-rallado-sin-gluten',
      'panko',
      'papel-de-arroz',
      'pasta-cocida',
      'pasta-de-curry-rojo',
      'pasta-de-curry-verde',
      'pasta-de-garbanzos',
      'pasta-de-lentejas',
      'pasta-fresca-al-huevo',
      'pasta-integral-cocida',
      'pasta-integral-seca',
      'pasta-sin-gluten',
      'pastilla-de-caldo',
      'pastilla-de-caldo-de-verduras',
      'pesto-genovese',
      'pesto-rojo',
      'pesto-vegano',
      'placas-de-lasana',
      'polenta',
      'polenta-cocida',
      'quinoa-cocida',
      'quinoa-cruda',
      'raviolis-frescos',
      'salsa-agridulce',
      'salsa-bolonesa-envasada',
      'salsa-carbonara-envasada',
      'salsa-cesar',
      'salsa-de-ostras',
      'salsa-de-pescado',
      'salsa-de-queso',
      'salsa-de-soja',
      'salsa-de-soja-baja-en-sal',
      'salsa-de-tomate-para-pizza',
      'salsa-hoisin',
      'salsa-ponzu',
      'salsa-romesco',
      'salsa-satay',
      'salsa-teriyaki',
      'salsa-worcestershire',
      'sazonador-para-tacos',
      'sofrito-envasado',
      'tamari',
      'tomate-entero-pelado',
      'tomate-frito',
      'tomate-triturado',
      'tomate-troceado-en-conserva',
      'tortellini',
      'trigo-sarraceno',
      'trigo-sarraceno-cocido',
      'vinagreta-envasada',
      'vino-blanco',
      'vino-tinto'
    ]
  },
  // 6. Cooking vegetables, fresh, frozen or tinned.
  {
    slots: LUNCH_AND_DINNER,
    slugs: [
      'acelga',
      'ajo-tierno',
      'alcachofa',
      'alcachofas-congeladas',
      'alcachofas-en-conserva',
      'apionabo',
      'berenjena',
      'bimi',
      'boletus',
      'boniato',
      'borraja',
      'brocoli',
      'brocoli-congelado',
      'brotes-de-bambu',
      'calabacin',
      'calabaza',
      'calabaza-cacahuete',
      'cardo',
      'champinon',
      'champinones-en-conserva',
      'chirivia',
      'col-blanca',
      'col-china',
      'col-rizada',
      'coles-de-bruselas',
      'coliflor',
      'coliflor-congelada',
      'colinabo',
      'daikon',
      'esparrago-blanco',
      'esparrago-verde',
      'esparragos-blancos-en-conserva',
      'espinacas-congeladas',
      'grelos',
      'guisantes-congelados',
      'guisantes-en-conserva',
      'guisantes-frescos',
      'habas-congeladas',
      'habas-en-conserva',
      'habas-frescas',
      'hinojo',
      'jackfruit',
      'judia-verde',
      'judia-verde-congelada',
      'judias-verdes-en-conserva',
      'lombarda',
      'mazorca-de-maiz',
      'menestra-congelada',
      'menestra-en-conserva',
      'mix-de-verduras-congelado',
      'nabo',
      'niscalos',
      'nora',
      'okra',
      'pak-choi',
      'palmitos',
      'patata-nueva',
      'pimiento-choricero',
      'pimiento-de-padron',
      'pimiento-del-piquillo',
      'pimiento-italiano',
      'pimientos-asados-en-conserva',
      'pimientos-tricolor-congelados',
      'pisto-congelado',
      'pisto-en-conserva',
      'platano-macho',
      'portobello',
      'remolacha',
      'remolacha-cocida',
      'remolacha-en-conserva',
      'romanesco',
      'salteado-de-verduras-congelado',
      'seta-de-cardo',
      'seta-ostra',
      'seta-shiitake',
      'setas-congeladas',
      'setas-variadas',
      'tirabeques',
      'verduras-para-sopa-congeladas',
      'yuca'
    ]
  },
  // 7. Tinned fish and seafood, cured sausages, olives, dips and savoury
  // pastries: an aperitivo, a bocadillo, a dinner — not a breakfast.
  {
    slots: NOT_BREAKFAST,
    slugs: [
      'aceitunas-negras',
      'aceitunas-rellenas-de-anchoa',
      'aceitunas-verdes',
      'almejas-al-natural',
      'anchoas-en-salazon',
      'atun-al-natural',
      'atun-en-aceite',
      'atun-en-escabeche',
      'baba-ganoush',
      'bacalao-ahumado',
      'berberechos-al-natural',
      'caballa-en-conserva',
      'chorizo',
      'empanada-de-atun',
      'fuet',
      'guacamole',
      'lomo-embuchado',
      'mejillones-en-escabeche',
      'melva-en-conserva',
      'mojama',
      'navajas-al-natural',
      'pate-de-higado',
      'pate-vegetal',
      'salchichon',
      'sardinas-en-aceite',
      'surimi',
      'tapenade',
      'tzatziki',
      'ventresca-de-atun'
    ]
  },
  // 8. Breakfast and sweet foods: cereals, pastries, biscuits, sweet spreads
  // and toppings, flavoured yoghurts, protein powders.
  {
    slots: BREAKFAST_AND_SNACKS,
    slugs: [
      'arroz-hinchado',
      'avena-en-grano',
      'barritas-de-cereales',
      'barritas-de-proteinas',
      'bizcocho',
      'bizcochos-de-soletilla',
      'brioche',
      'brownie',
      'cabello-de-angel',
      'cereales-de-chocolate',
      'cereales-integrales',
      'chocolate-blanco',
      'chocolate-con-almendras',
      'chocolate-con-leche',
      'chocolate-negro-70',
      'chocolate-negro-85',
      'churros',
      'compota-de-fruta',
      'cookies-de-chocolate',
      'copos-de-avena',
      'copos-de-centeno',
      'copos-de-espelta',
      'copos-de-maiz',
      'crema-de-avellanas-y-cacao',
      'croissant',
      'donut',
      'dulce-de-membrillo',
      'ensaimada',
      'fruta-en-almibar',
      'galletas-de-avena',
      'galletas-de-mantequilla',
      'galletas-digestive',
      'galletas-maria',
      'galletas-rellenas-de-chocolate',
      'galletas-sin-gluten',
      'germen-de-trigo',
      'gofre',
      'granola',
      'leche-condensada',
      'macedonia-en-conserva',
      'magdalena',
      'mermelada-de-fresa',
      'mermelada-de-frutos-rojos',
      'mermelada-de-melocoton',
      'mermelada-de-naranja',
      'mermelada-light',
      'muesli',
      'napolitana-de-chocolate',
      'nata-montada',
      'nibs-de-cacao',
      'palmera-de-hojaldre',
      'pan-de-higo',
      'pan-de-leche',
      'pan-tostado',
      'petit-suisse',
      'proteina-de-guisante',
      'proteina-de-suero',
      'pure-de-manzana',
      'quinoa-hinchada',
      'rosquillas',
      'salvado-de-avena',
      'salvado-de-trigo',
      'sobaos',
      'tarta-de-manzana',
      'tarta-de-queso',
      'tortitas-americanas',
      'tortitas-de-arroz',
      'tortitas-de-maiz',
      'yogur-bebible',
      'yogur-de-sabores'
    ]
  },
  // 8. Breakfast and snack drinks: juices, cocoa, milkshakes, protein drinks.
  {
    slots: BREAKFAST_AND_SNACKS,
    slugs: [
      'agua-de-coco',
      'batido-de-cacao',
      'batido-de-fresa',
      'bebida-de-proteinas',
      'bebida-de-proteinas-vegetal',
      'cacao-soluble',
      'zumo-de-arandanos',
      'zumo-de-granada',
      'zumo-de-manzana',
      'zumo-de-melocoton',
      'zumo-de-naranja',
      'zumo-de-pina',
      'zumo-de-tomate',
      'zumo-de-uva',
      'zumo-multifrutas',
      'zumo-verde'
    ]
  },
  // 9. Sweets, desserts, ice creams and salty snacks: the snacks only — and
  // the two drinks that are a snack of their own, horchata and an isotonic.
  {
    slots: SNACKS,
    slugs: [
      'arroz-con-leche',
      'bebida-isotonica',
      'bombones',
      'chips-de-verduras',
      'crema-catalana',
      'flan-de-huevo',
      'gelatina-de-sabores',
      'gelatina-de-sabores-preparada',
      'gominolas',
      'helado-de-chocolate',
      'helado-de-fresa',
      'helado-de-vainilla',
      'horchata',
      'kikos',
      'mazapan',
      'mousse-de-chocolate',
      'nachos',
      'natillas',
      'palomitas-de-maiz',
      'palomitas-hechas',
      'patatas-fritas-de-bolsa',
      'polo-de-fruta',
      'polvoron',
      'pretzels',
      'sorbete-de-limon',
      'tarta-de-santiago',
      'tiramisu',
      'turron-de-alicante',
      'turron-de-jijona',
      'yogur-helado'
    ]
  },
  // 10. Soft drinks and alcohol-free beer: with a meal or an aperitivo, not
  // with breakfast.
  { slots: NOT_BREAKFAST, slugs: ['cerveza-sin-alcohol', 'kombucha', 'limonada', 'refresco-de-cola', 'refresco-light', 'tonica'] },
  // 10. Alcohol-free wine goes with a meal.
  { slots: LUNCH_AND_DINNER, slugs: ['vino-sin-alcohol'] },
  // 8b. Coffee and tea: breakfast and the day's snacks, not supper — no
  // caffeine before bed (owner, 2026-09-25).
  { slots: BREAKFAST_AND_DAY_SNACKS, slugs: ['cafe-descafeinado', 'cafe-solo', 'te-matcha', 'te-negro', 'te-verde'] },
  // In no meal: the energy drink (owner, 2026-09-25).
  { slots: NO_MEAL, slugs: ['bebida-energetica'] },
  // 10. Infusions: breakfast, the snacks and after dinner — not with lunch.
  { slots: NOT_LUNCH, slugs: ['infusion-de-manzanilla', 'infusion-de-menta-poleo', 'infusion-de-rooibos'] }
];

/** Every named row and its meals, as written, so `meals.test.ts` can refuse a row named twice. */
export const MEAL_ROWS: readonly (readonly [string, readonly MealEntry[]])[] = GROUPS.flatMap(group =>
  group.slugs.map(slug => [slug, group.slots] as const)
);

const ONLY_AT: ReadonlyMap<string, readonly MealEntry[]> = new Map(MEAL_ROWS);

/** The meals a row belongs to: empty for every meal, `['none']` for none. */
export function mealSlotsFor(entry: IngredientSeed): readonly MealEntry[] {
  return ONLY_AT.get(entry.slug) ?? [];
}
