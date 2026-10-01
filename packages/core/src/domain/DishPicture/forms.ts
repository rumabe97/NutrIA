/**
 * The closed tables of the picture judge's own-form rule (`0073`, project 010).
 *
 * A picture shows a form — pancakes, bread, meatballs, milk — not what it is
 * made of. When the dish has its own version of a form, a name the judge gave
 * that is exactly the form brings no allergens (`judge.ts`). The rule is a
 * list of what passes, not of what does not: a name passes only if, once the
 * serving words of `SERVING_WORDS` are set aside, it *is* one row of `seen`
 * of a family the dish holds. Anything else — "wheat noodles", "cheese
 * pancakes", "whole milk", "cinnamon roll", "cream cheese" — is read exactly
 * as it was before the rule, notes and all.
 *
 * Every list here is closed and exact: a word is matched as a word (and its
 * plural, as the rule meets "prawns" and "prawn"), a slug as the whole slug, a
 * title word as a whole word of the normalised title. Nothing is guessed from
 * a category, a weight or a spelling. Each row has its case in both directions
 * in `forms.test.ts` and `judge.forms.test.ts`; a row without one does not
 * merge. When in doubt a row stays out: a missing row is a picture rejected
 * and drawn again, a wrong one is a picture accepted.
 */

/**
 * A family: forms a picture cannot tell apart (report `0006` § 7.3). Having
 * gluten-free bread does not excuse pancakes, and a title that names pancakes
 * does not excuse toast.
 */
export type FormFamily = {
  /**
   * The allergens the form's usual recipe brings and a picture of it cannot
   * show — a closed set, written here, never read from the catalogue. A name
   * of the dish's own form is excused of these and of nothing else, whatever
   * the row: a brownie's walnuts, a tuna empanada's fish, the soy of a
   * vegetable nugget are weighed against the dish as any food is.
   */
  readonly carries: readonly string[];
  /** A short name, for the tests and the reviewer. */
  readonly family: string;
  /**
   * The judge's names for the form, in English, singular: the whole name, not
   * a word of it. A name passes only when it is one of these, word for word
   * (plurals and `SPELLINGS` aside), after `SERVING_WORDS`. What a row carries
   * beyond the family's `carries` is pinned in `forms.test.ts`.
   */
  readonly seen: readonly string[];
  /** Catalogue slugs that *are* that form. Empty: only a title names the family. */
  readonly slugs: readonly string[];
  /**
   * Words of a dish's title that name the form, normalised (lower case, no
   * accents), Spanish then English, each plural written out. A phrase is its
   * words in order.
   */
  readonly title: readonly string[];
  /** A dish holding one of these slugs: its title does not name this family ("tortitas" are its rice cakes). */
  readonly titleNotWith?: readonly string[];
  /**
   * Words of a title that, negated, say the dish has none of the form: a
   * crustless "quiche sin masa" names no pastry. A negated title word of the
   * family does the same ("hamburguesa sin pan" names no bread).
   */
  readonly without?: readonly string[];
};

const CAKES_OF_A_CEREAL = ['tortitas-de-arroz', 'tortitas-de-maiz'] as const;

export const FORM_FAMILIES: readonly FormFamily[] = [
  {
    carries: ['gluten'],
    family: 'bread',
    seen: ['bread', 'toast', 'bun', 'roll', 'baguette', 'sandwich', 'crouton'],
    slugs: ['pan-sin-gluten'],
    title: [
      'pan',
      'panes',
      'panecillo',
      'panecillos',
      'tostada',
      'tostadas',
      'tosta',
      'tostas',
      'tostaditas',
      'rebanada',
      'rebanadas',
      'bocadillo',
      'bocadillos',
      'sandwich',
      'sandwiches',
      'bikini',
      'montadito',
      'montaditos',
      'arepa',
      'arepas',
      'migas',
      'bread',
      'breads',
      'toast',
      'toasts',
      'baguette'
    ]
  },
  /*
   * Breadcrumbs or cornflakes in a dish can be a binder or a cereal, and are
   * not seen as a coating: only a title that says the dish is breaded keys this
   * family (phase 1's review). "Empanada" is a pasty, not a breading: it names
   * the pastry family, and only as a title's head (`TITLE_ONLY_AS_HEAD`), so a
   * breaded "pechuga empanada" excuses neither.
   */
  {
    // Breadcrumbs, and a batter's flour and egg.
    carries: ['eggs', 'gluten'],
    family: 'breading',
    // "breaded chicken" and "battered fish" are how the judge names a coated fillet; the fish is still the fish (`judge.ts`).
    seen: ['breadcrumb', 'crumb', 'breaded', 'batter', 'battered', 'tempura', 'breaded chicken', 'battered fish'],
    slugs: [],
    title: ['rebozado', 'rebozada', 'rebozados', 'rebozadas', 'empanado', 'empanados', 'tempura', 'battered', 'breaded']
  },
  {
    // A batter of flour, egg and milk.
    carries: ['eggs', 'gluten', 'milk'],
    family: 'pancakes',
    seen: ['pancake', 'crepe', 'waffle', 'fritter'],
    slugs: [],
    title: [
      'tortita',
      'tortitas',
      'crepe',
      'crepes',
      'crep',
      'creps',
      'galette',
      'galettes',
      'gofre',
      'gofres',
      'blini',
      'blinis',
      'bunuelo',
      'bunuelos',
      'pancake',
      'pancakes',
      'waffle',
      'waffles',
      'fritter',
      'fritters'
    ],
    titleNotWith: CAKES_OF_A_CEREAL
  },
  /*
   * A rice or corn cake is a cracker, not a sponge (phase 1's review): it keys
   * no cake, and "rice cakes" in a title names none. The English plural
   * "cakes" is no title word either: "fish cakes" and "potato cakes" are
   * patties. "Pastel" names a cake only as a title's head, and not before
   * "de": "pastel de verduras" is a savoury terrine.
   */
  {
    // A sponge's flour, egg and milk or butter. Not the nuts of a brownie: they are a brownie's filling, not its form.
    carries: ['eggs', 'gluten', 'milk'],
    family: 'cakes',
    seen: ['cake', 'muffin', 'cupcake', 'brownie'],
    slugs: [],
    title: [
      'bizcocho',
      'bizcochos',
      'magdalena',
      'magdalenas',
      'muffin',
      'muffins',
      'tarta',
      'tartas',
      'pastel',
      'pasteles',
      'brownie',
      'brownies',
      'cake',
      'cupcake',
      'cupcakes'
    ],
    titleNotWith: CAKES_OF_A_CEREAL,
    // A "tarta salada sin masa" is a crustless savoury tart: no sponge, no pastry.
    without: ['masa', 'base']
  },
  {
    // A butter biscuit's flour, egg and butter. A crumble's topping is the same dough, rubbed loose.
    carries: ['eggs', 'gluten', 'milk'],
    family: 'biscuits',
    seen: ['biscuit', 'cookie', 'crumble'],
    slugs: ['galletas-sin-gluten'],
    title: ['galleta', 'galletas', 'biscuit', 'biscuits', 'cookie', 'cookies', 'crumble', 'crumbles']
  },
  // A cracker's flour. Not the sesame the catalogue's crackers may contain: no allergen is excused only because a product may contain it.
  { carries: ['gluten'], family: 'crackers', seen: ['cracker'], slugs: [...CAKES_OF_A_CEREAL], title: [] },
  {
    carries: ['gluten'],
    family: 'wraps',
    seen: ['tortilla', 'wrap', 'taco', 'burrito', 'flatbread', 'pita', 'pitta'],
    slugs: ['tortilla-de-maiz', 'nachos'],
    title: [
      'wrap',
      'wraps',
      'taco',
      'tacos',
      'burrito',
      'burritos',
      'fajita',
      'fajitas',
      'enchilada',
      'enchiladas',
      'quesadilla',
      'quesadillas',
      'arepa',
      'arepas',
      'flatbread',
      'flatbreads'
    ],
    without: ['tortilla', 'tortillas']
  },
  /*
   * An English "pie" is no title word: a cottage or shepherd's pie is mince
   * under mashed potato, with no pastry at all.
   */
  {
    // Flour, the butter of puff and shortcrust pastry, a quiche's egg. Not a filling: the catalogue's empanada is tuna, and its fish is not a pastry's.
    carries: ['eggs', 'gluten', 'milk'],
    family: 'pastry',
    seen: ['pizza', 'pizza base', 'pizza crust', 'crust', 'dough', 'pastry', 'pie', 'tart', 'quiche', 'empanada', 'dumpling', 'gyoza'],
    slugs: [],
    title: [
      'pizza',
      'pizzas',
      'empanada',
      'empanadas',
      'empanadilla',
      'empanadillas',
      'quiche',
      'quiches',
      'hojaldre',
      'gyoza',
      'gyozas',
      'tart',
      'tarts',
      'pastry',
      'pastries',
      'dumpling',
      'dumplings'
    ],
    without: ['masa', 'hojaldre', 'base', 'crust', 'dough', 'pastry']
  },
  {
    // Wheat, and the egg of egg pasta and lasagna sheets.
    carries: ['eggs', 'gluten'],
    family: 'pasta',
    seen: ['pasta', 'noodle', 'spaghetti', 'penne', 'macaroni', 'fusilli', 'lasagna'],
    slugs: ['pasta-sin-gluten', 'fideos-de-arroz-cocidos', 'fideos-de-arroz-secos', 'fideos-de-cristal', 'pasta-de-lentejas', 'pasta-de-garbanzos'],
    title: []
  },
  /*
   * For a plant protein, firm tofu and minced meat alike (report § 14, question
   * 3): what is at stake is the binder of a jarred meatball, which no picture
   * shows. A bare "burger" is not here: a burger is seen in its bun, and the
   * bun's gluten is what rejects it (phase 1's review). "burger patty" and
   * "patty" are the meat alone.
   */
  {
    // The binder of a jarred meatball or a burger patty — breadcrumbs, egg, milk — never the meat or the plant protein itself.
    carries: ['eggs', 'gluten', 'milk'],
    family: 'meat',
    seen: ['meatball', 'burger patty', 'patty', 'sausage'],
    slugs: [
      'heura',
      'seitan',
      'tofu-firme',
      'tofu-ahumado',
      'tempeh',
      'soja-texturizada',
      'hamburguesa-vegetal',
      'carne-picada-de-ternera',
      'carne-picada-de-cerdo',
      'carne-picada-mixta',
      'cordero-picado',
      'pollo-picado',
      'pavo-picado'
    ],
    title: [
      'albondiga',
      'albondigas',
      'hamburguesa',
      'hamburguesas',
      'salchicha',
      'salchichas',
      'meatball',
      'meatballs',
      'burger',
      'burgers',
      'sausage',
      'sausages'
    ]
  },
  /* A breaded form is seen to be breaded: the title excuses it, the protein under it never does (report § 7.3). */
  {
    // The coating's flour and egg, and a croquette's béchamel. Not the soy of a vegetable nugget: that is the protein, which the dish must hold itself.
    carries: ['eggs', 'gluten', 'lactose', 'milk'],
    family: 'nuggets',
    seen: ['nugget', 'croquette'],
    slugs: [],
    title: ['nugget', 'nuggets', 'croqueta', 'croquetas', 'croquette', 'croquettes']
  },
  {
    carries: ['lactose', 'milk'],
    family: 'milk',
    // A latte is a glass of the dish's milk with coffee: made with oat milk, it looks the same.
    seen: ['milk', 'milkshake', 'latte'],
    slugs: [
      'leche-de-soja',
      'leche-de-avena',
      'leche-de-almendra',
      'leche-de-coco',
      'leche-de-coco-ligera',
      'bebida-de-arroz',
      'bebida-de-coco',
      'bebida-de-avellanas',
      'bebida-de-anacardos',
      // Its "milk" brings no lactose the dish lacks: lactose as a foreign allergen waits for production data (PRD, Out).
      'leche-sin-lactosa'
    ],
    title: []
  },
  { carries: ['lactose', 'milk'], family: 'yogurt', seen: ['yogurt', 'yoghurt'], slugs: ['yogur-de-soja', 'yogur-de-coco'], title: [] },
  /* Tofu is not a cheese (report § 6): a grated cheese does not look like a cube of tofu, and the judge never mixed them up. */
  // Not lactose: the judge's "cheese" reads as the catalogue's cured cheeses, which carry none, so a lactose here would be excused for nothing.
  { carries: ['milk'], family: 'cheese', seen: ['cheese'], slugs: ['queso-vegano'], title: [] },
  {
    carries: ['lactose', 'milk'],
    family: 'cream',
    seen: ['cream'],
    slugs: ['crema-de-coco', 'leche-de-coco', 'leche-de-coco-ligera', 'nata-vegetal-de-soja', 'nata-vegetal-de-avena'],
    title: []
  }
];

/**
 * Phrases of a title in which a title word does not name its form: "pan
 * rallado" is breadcrumbs, an English title's "pan-fried" or "pan sauce" is
 * no bread, "migas de atún" are flakes of tuna.
 */
export const TITLE_NOT_A_FORM: readonly string[] = [
  'migas de atun',
  'migas de bacalao',
  'one pan',
  'pan fried',
  'pan gravy',
  'pan grilled',
  'pan juices',
  'pan rallado',
  'pan roasted',
  'pan sauce',
  'pan seared',
  'sheet pan'
];

/**
 * Title words that name a form only as the title's head — its first word —
 * and only when what follows is the end of the title or a word of
 * `TITLE_HEAD_ENDS`. Elsewhere they are another word: "semillas tostadas"
 * are toasted, a "pechuga empanada" is breaded, "tacos de queso" are cubes,
 * "lettuce wraps" are leaves, "sweet potato toast" is a slice of sweet
 * potato. After the head, anything but those words may say what stands in
 * for the form: "tostadas de boniato", "tostadas crujientes de boniato" and
 * "tostadas del huerto" are slices of vegetable, "tacos en hojas de lechuga"
 * and "wraps frescos de lechuga" are lettuce leaves, "sándwich vegetal de
 * lechuga" has no bread, "quesadilla de boniato", "enchiladas de calabacín"
 * and "montadito de berenjena" are made of the vegetable, "taco salad" has
 * no tortilla, "pastel de verduras" is a terrine — none is bread, a tortilla
 * or a cake, and a picture of it named so is rejected (decided conservative
 * in phase 2's reviews). A dish of bread or tortillas is keyed by its
 * ingredient all the same.
 */
export const TITLE_ONLY_AS_HEAD: readonly string[] = [
  'burrito',
  'burritos',
  'empanada',
  'empanadas',
  'enchilada',
  'enchiladas',
  'fajita',
  'fajitas',
  'montadito',
  'montaditos',
  'pastel',
  'pasteles',
  'quesadilla',
  'quesadillas',
  'rebanada',
  'rebanadas',
  'sandwich',
  'sandwiches',
  'taco',
  'tacos',
  'toast',
  'toasts',
  'tosta',
  'tostada',
  'tostadas',
  'tostas',
  'tostaditas',
  'wrap',
  'wraps'
];

/** What may follow a word of `TITLE_ONLY_AS_HEAD` for it to name its form: "tostadas con aguacate", "toast with avocado". Punctuation between is skipped. */
export const TITLE_HEAD_ENDS: readonly string[] = ['and', 'con', 'with', 'y'];

/**
 * A title word next to one of these names no form: a "burrito bowl", a "bowl
 * de burrito", a "burrito bol" and a "taco bowl" are served without their
 * tortilla.
 */
export const TITLE_BOWL: readonly string[] = ['bol', 'boles', 'bowl', 'bowls', 'cuenco', 'cuencos'];

/**
 * Words and phrases of a title that negate every word after them up to a
 * word of `TITLE_NEGATION_ENDS`: "hamburguesa sin queso ni pan", "sin su
 * pan", "sin nada de pan", "con lechuga en vez de pan", "burger with lettuce
 * instead of bread", "burger without any bread" name no bread. A negated word
 * of a family, or of its `without`, takes the whole family's title key away.
 *
 * Two suffixes negate only the word they are part of, not what follows: a
 * word right before "free" ("bread-free bowl"), and a word ending in "less",
 * written apart or not ("breadless burger", "crustless quiche", "crust-less
 * quiche" — the crust, and so the pastry family). "Gluten-free bread" is
 * bread: "free" negates the gluten.
 */
export const TITLE_NEGATIONS: readonly string[] = ['sin', 'ni', 'no', 'without', 'en vez de', 'en lugar de', 'instead of', 'libre de'];

/** What ends a negation's reach: "hamburguesa sin gluten con pan", "pan sin gluten, con tomate" still name bread. `,` and `)` are the punctuation a title is read with. */
export const TITLE_NEGATION_ENDS: readonly string[] = ['con', 'with', 'y', 'and', ',', ')'];

/** Two spellings of one word, the judge's American and the catalogue's British: "yogurt" beside "soya yoghurt" is the same word twice. */
export const SPELLINGS: ReadonlyMap<string, string> = new Map([
  ['pitta', 'pita'],
  ['yoghurt', 'yogurt']
]);

/**
 * Another word the judge uses for a word the rule already reads (project 010,
 * phase 5): read as that word everywhere — in a seen name, in a catalogue
 * name, in a family's row. "hamburger" is a burger and "hamburger patty" the
 * row "burger patty"; "omelet" is the American "omelette". Before, each was
 * a word nothing held, and mapped to no allergen.
 */
export const SAME_WORD: ReadonlyMap<string, string> = new Map([
  ['hamburger', 'burger'],
  ['omelet', 'omelette']
]);

/**
 * A form's word alone, read as the form with nothing in it (project 010,
 * phase 5): the catalogue slugs whose allergens the bare word carries. It is
 * read before the catalogue, because the catalogue's only product of that
 * name is a filled one — its brownie may contain nuts, its empanada is tuna,
 * its crackers may contain sesame, its "sandwich" is a chocolate sandwich
 * biscuit — and a bare word does not say the filling. "Brownie" is a sponge's
 * flour, egg and milk; "a slice of brownie" too. A name that says more is
 * read as it always was: "walnut brownie" is walnuts, "tuna empanada" is
 * tuna. Each word is a row of a family, and carries nothing beyond that
 * family's closed set (`forms.test.ts`).
 */
export const BARE_FORMS: ReadonlyMap<string, readonly string[]> = new Map([
  ['brownie', ['bizcocho']],
  ['cracker', ['harina-de-trigo']],
  ['empanada', ['obleas-de-empanadillas']],
  ['sandwich', ['pan-de-molde']]
]);

/**
 * A word that names two foods with different allergens (project 010, phase
 * 5), read from the dish — never the way that fits it best. "tortilla" is a
 * Spanish omelette on a dish that *is* one, and a wheat wrap, with its gluten,
 * on every other dish: a dish of corn tortillas excuses it as its own
 * wraps-family form, and a dish with egg and no gluten that is no omelette
 * rejects it (the lead's decision: a wheat wrap must never pass on a dish a
 * coeliac may eat). A dish is an omelette by its title — a phrase that names
 * one anywhere, or "tortilla" as its first word on a dish that holds an egg (a
 * "tortilla de espinacas", a "tortilla francesa": two of the library's would
 * otherwise be rejected for their own name) — or by holding the packaged
 * omelette. Never by an egg and a potato alone: a potato salad with egg, or
 * "huevos rotos", is no omelette, and a wrap named "tortilla" on it keeps its
 * gluten (the reviewer's P2-5; every omelette of the library is named by its
 * title). Before, the word alone mapped to nothing and let a wrap
 * through on a dish of chicken and rice. A name that says more — "wheat
 * tortilla", "spanish tortilla" — is read as it always was. Known misses,
 * pinned in `judge.holes.test.ts`: the bare word on a dish that is one of the
 * two foods is read as that food, so a picture of the other one passes where
 * the dish carries what it would bring.
 */
export type DishReading = {
  /** What the word carries on any dish that is not `when`'s food. */
  readonly otherwise: readonly string[];
  readonly when: {
    /** What the word carries on that dish. */
    readonly reads: readonly string[];
    /** The dish holds one of these: the food itself. */
    readonly slugs: readonly string[];
    /** Or its title names it, as a normalised title reads it, not negated. */
    readonly title: readonly string[];
    /** Or one of `words` is the title's first word, not negated, on a dish that holds one slug of each group of `holds`. */
    readonly titleHead: { readonly holds: readonly (readonly string[])[]; readonly words: readonly string[] };
  };
};

export const READINGS: ReadonlyMap<string, DishReading> = new Map([
  [
    'tortilla',
    {
      otherwise: ['tortilla-de-trigo'],
      when: {
        reads: ['tortilla-de-patatas-envasada'],
        slugs: ['tortilla-de-patatas-envasada'],
        // A frittata is an Italian omelette: one of the library's holds egg and potato, and is named so only by its title.
        title: ['tortilla de patata', 'tortilla de patatas', 'tortilla espanola', 'omelette', 'omelettes', 'frittata', 'frittatas'],
        titleHead: { holds: [['huevo', 'clara-de-huevo', 'huevo-de-codorniz']], words: ['tortilla', 'tortillas'] }
      }
    }
  ]
]);

/**
 * The only words a name of the dish's own form may carry beside its `seen`
 * row: how it is served or cut, never what it is. "a glass of milk" on a
 * dish of soy milk is its milk, "grated cheese" on a dish of vegan cheese is
 * its cheese. A word that says what kind the food is — "whole", "skimmed",
 * "fresh", "light", "heavy", "cow's", "goat", "dairy", "cream", "cinnamon" —
 * is deliberately not here: "whole milk" and "cow's milk" both read as milk,
 * whatever the dish holds. Each word has its case in `forms.test.ts`.
 */
export const SERVING_WORDS: readonly string[] = [
  'a',
  'bowl',
  'cup',
  'glass',
  'grated',
  'melted',
  'of',
  'piece',
  'pieces',
  'slice',
  'sliced',
  'slices',
  'stack',
  'toasted'
];

/**
 * Words the judge uses for how a food is served, not for a food: "grain base",
 * "glass of milk", "rice bowl". They are not mapped one by one — the step
 * that reads a loose word as every catalogue row holding it read "base" as a
 * pizza base. A whole catalogue name holding one still counts: a pizza base
 * is a pizza base. (What may stand beside a form's own name is
 * `SERVING_WORDS`, a list of its own.)
 */
export const NOT_A_FOOD: readonly string[] = ['base', 'glass', 'bowl', 'cup', 'stick', 'bed', 'layer', 'stack', 'mix'];

/**
 * A named plant right before a dairy word says what the food is made of:
 * "soy yogurt" is soy, "coconut milk" is coconut, "almond butter" is almonds.
 * The plant is mapped and the dairy word is not — unless the whole name is a
 * catalogue name, which is read as it is. Anywhere else they are words like
 * any other.
 */
export const PLANT_QUALIFIERS: readonly string[] = ['almond', 'cashew', 'coconut', 'hazelnut', 'nut', 'oat', 'rice', 'soy', 'soya'];

/**
 * Words that say only that a food is not dairy, never what it is made of: no
 * plant, and deliberately not in `PLANT_QUALIFIERS` (the lead's decision,
 * round 3). "Vegan butter", "vegetable cream", "plant milk" could be soy or
 * nuts, so they read as they always have: the dairy word is milk, and a
 * loose "plant" is the catalogue's plant protein, and its soy.
 *
 * @knipignore Exported for its test, which keeps these words out of the plant tables.
 */
export const NOT_A_PLANT: readonly string[] = ['plant', 'vegan', 'vegetable'];

export const DAIRY_WORDS: readonly string[] = ['butter', 'cheese', 'cream', 'milk', 'yoghurt', 'yogurt'];

/**
 * Allergens that never reject a picture when a food only *may* contain them
 * (owner, 2026-09-30): nobody sees a sulphite. One a food *contains* — dried
 * apricots, wine — still rejects.
 */
export const UNSEEN_WHEN_ONLY_MAY_CONTAIN: readonly string[] = ['sulphites'];
