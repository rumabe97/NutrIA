/**
 * What to reach for when the shop does not have it.
 *
 * Pairs are **catalogue rows**, never free text, so every alternative carries
 * the substitute's own allergen links and macros — the same rows the dish was
 * checked against — and can be filtered per person in code before it is shown
 * (`core/domain/Substitution`). A swap the model invented would have neither.
 *
 * Two shapes. A **group** is a family whose members stand in for each other at
 * the same weight: one legume for another, one white fish for another. An
 * **extra** is one-way, for the cases a group would get wrong — butter can become
 * olive oil, but a dish written around olive oil is not improved by butter; cow's
 * milk can become oat milk, but a dish written dairy-free must never be offered
 * milk. The rule the seed test enforces: **a swap never introduces a class of food
 * the dish did not already have** — no meat, fish, shellfish, pork, dairy, egg or
 * any animal product into a dish that had none. That is what keeps a vegetarian's,
 * a pescatarian's or a halal plan intact without the code knowing their pattern.
 *
 * Staples get no alternatives on purpose: salt, olive oil, onion, garlic, tomato,
 * eggs, the spices. Every shop has them, and a line of "or instead" under each
 * would bury the swaps that matter. The `ratio` scales the weight — `2` means
 * twice as much of the substitute.
 */

export type SubstitutionGroup = {
  readonly members: readonly string[];
  readonly name: string;
};

export type SubstitutionExtra = {
  readonly from: string;
  readonly ratio?: number;
  readonly to: string;
};

export type SubstitutionPair = {
  readonly ingredient: string;
  readonly ratio: number;
  readonly substitute: string;
};

export const SUBSTITUTION_GROUPS: readonly SubstitutionGroup[] = [
  { members: ['lentejas-cocidas', 'garbanzos-cocidos', 'alubias-blancas-cocidas', 'alubias-pintas-cocidas', 'lentejas-rojas-cocidas'], name: 'legumbres' },
  { members: ['seitan', 'tofu-firme', 'tempeh', 'soja-texturizada'], name: 'proteína vegetal' },
  { members: ['merluza', 'filete-de-merluza-congelado', 'bacalao-desalado', 'dorada', 'lubina', 'salmon', 'sardina'], name: 'pescado' },
  { members: ['gambas', 'calamar', 'mejillon', 'almeja', 'pulpo-cocido'], name: 'marisco' },
  { members: ['pechuga-de-pollo', 'muslo-de-pollo', 'pavo', 'conejo'], name: 'carne blanca' },
  { members: ['ternera-magra', 'solomillo-de-ternera'], name: 'ternera' },
  { members: ['jamon-serrano', 'jamon-cocido'], name: 'jamón' },
  { members: ['leche-entera', 'leche-semidesnatada', 'leche-desnatada'], name: 'leche' },
  { members: ['leche-de-almendra', 'leche-de-avena', 'leche-de-soja'], name: 'bebida vegetal' },
  { members: ['yogur-griego-natural', 'yogur-natural-desnatado', 'kefir'], name: 'yogur' },
  { members: ['queso-de-burgos', 'queso-cottage', 'requeson', 'queso-fresco-de-cabra', 'queso-mozzarella'], name: 'queso fresco' },
  { members: ['queso-curado', 'queso-parmesano'], name: 'queso curado' },
  { members: ['arroz-blanco-cocido', 'arroz-basmati-cocido', 'arroz-integral-cocido', 'quinoa-cocida', 'bulgur-cocido', 'cuscus-cocido'], name: 'cereal cocido' },
  { members: ['pasta-cocida', 'pasta-integral-cocida', 'fideos-de-arroz-cocidos'], name: 'pasta' },
  { members: ['pan-blanco', 'pan-integral', 'pan-de-centeno', 'pan-de-molde'], name: 'pan' },
  { members: ['tortitas-de-arroz', 'tortitas-de-maiz'], name: 'tortitas' },
  { members: ['harina-de-trigo', 'harina-de-avena'], name: 'harina' },
  { members: ['almendras', 'avellanas', 'nueces', 'anacardos', 'pistachos', 'cacahuetes'], name: 'frutos secos' },
  { members: ['pipas-de-girasol', 'semillas-de-calabaza', 'sesamo'], name: 'semillas' },
  { members: ['semillas-de-chia', 'semillas-de-lino'], name: 'semillas que espesan' },
  { members: ['brocoli', 'coliflor', 'brocoli-congelado'], name: 'crucíferas' },
  { members: ['espinaca', 'col-rizada', 'espinacas-congeladas'], name: 'hoja verde' },
  { members: ['lechuga', 'escarola', 'rucula'], name: 'ensalada' },
  { members: ['calabacin', 'berenjena'], name: 'verdura de sartén' },
  { members: ['patata', 'boniato'], name: 'tubérculo' },
  { members: ['pimiento-rojo', 'pimiento-verde'], name: 'pimiento' },
  { members: ['judia-verde', 'judia-verde-congelada', 'guisantes-congelados'], name: 'verdura verde' },
  { members: ['maiz-dulce', 'maiz-congelado'], name: 'maíz' },
  { members: ['tomate-triturado', 'tomate-frito'], name: 'tomate en conserva' },
  { members: ['manzana', 'pera', 'melocoton', 'kiwi', 'naranja', 'platano', 'fresa', 'uva', 'melon', 'sandia'], name: 'fruta fresca' },
  { members: ['fresa', 'frutos-rojos-congelados'], name: 'frutos rojos' },
  { members: ['aguacate', 'guacamole'], name: 'aguacate' },
  { members: ['vinagre-de-jerez', 'vinagre-de-manzana', 'vinagre-de-vino-tinto'], name: 'vinagre' },
  { members: ['mostaza-de-dijon', 'mostaza-amarilla'], name: 'mostaza' },
  { members: ['salsa-sriracha', 'salsa-picante-tabasco'], name: 'picante' },
  { members: ['salsa-alioli', 'mayonesa'], name: 'salsa cremosa' },
  { members: ['aceitunas-negras', 'aceitunas-verdes'], name: 'aceitunas' },
  { members: ['alcaparras', 'pepinillos-en-vinagre'], name: 'encurtidos' }
];

export const SUBSTITUTION_EXTRAS: readonly SubstitutionExtra[] = [
  // Out of pork, never into it.
  { from: 'lomo-de-cerdo', to: 'pechuga-de-pollo' },
  { from: 'lomo-de-cerdo', to: 'pavo' },
  { from: 'lomo-de-cerdo', to: 'ternera-magra' },
  { from: 'costillas-de-cerdo', to: 'muslo-de-pollo' },
  // Red meat to white; a mince to the one thing that behaves like mince.
  { from: 'ternera-magra', to: 'pechuga-de-pollo' },
  { from: 'ternera-magra', to: 'pavo' },
  { from: 'solomillo-de-ternera', to: 'pechuga-de-pollo' },
  { from: 'carne-picada-de-ternera', to: 'soja-texturizada' },
  // The two tins.
  { from: 'atun-al-natural', to: 'sardina' },
  { from: 'sardina', to: 'atun-al-natural' },
  // Dairy to plant, one direction.
  { from: 'leche-entera', to: 'leche-de-avena' },
  { from: 'leche-semidesnatada', to: 'leche-de-avena' },
  { from: 'leche-desnatada', to: 'leche-de-avena' },
  { from: 'nata-para-cocinar', to: 'yogur-griego-natural' },
  { from: 'mantequilla', ratio: 0.8, to: 'aceite-de-oliva-virgen-extra' },
  { from: 'mantequilla', to: 'aceite-de-coco' },
  { from: 'queso-parmesano', ratio: 0.5, to: 'levadura-nutricional' },
  // Fats and thickeners.
  { from: 'aceite-de-girasol', to: 'aceite-de-oliva-virgen-extra' },
  { from: 'aceite-de-coco', to: 'aceite-de-oliva-virgen-extra' },
  { from: 'maicena', ratio: 2, to: 'harina-de-trigo' },
  // Breakfast.
  { from: 'copos-de-avena', to: 'muesli' },
  { from: 'muesli', to: 'copos-de-avena' },
  { from: 'copos-de-maiz', to: 'muesli' },
  { from: 'mantequilla-de-cacahuete', to: 'tahini' },
  { from: 'tahini', to: 'mantequilla-de-cacahuete' },
  // A nut-free way out of every nut.
  { from: 'almendras', to: 'pipas-de-girasol' },
  { from: 'avellanas', to: 'pipas-de-girasol' },
  { from: 'nueces', to: 'pipas-de-girasol' },
  { from: 'anacardos', to: 'pipas-de-girasol' },
  { from: 'pistachos', to: 'pipas-de-girasol' },
  { from: 'cacahuetes', to: 'pipas-de-girasol' },
  // Towards the staple, never away from it.
  { from: 'chalota', to: 'cebolla' },
  { from: 'cebolleta', to: 'cebolla' },
  { from: 'puerro', to: 'cebolla' },
  { from: 'esparrago-verde', to: 'judia-verde' },
  { from: 'calabaza', to: 'boniato' },
  { from: 'calabaza', to: 'zanahoria' },
  { from: 'guisantes-congelados', to: 'edamame-cocido' },
  { from: 'caldo-de-pollo', to: 'caldo-de-verduras' },
  { from: 'miel', to: 'sirope-de-agave' }
];

/**
 * Every ordered pair the seed writes: each group member for each other member,
 * then the extras. First mention wins, so a pair a group already produced is not
 * duplicated by an extra, and the unique constraint on the table is never hit.
 */
export function substitutionPairs(): readonly SubstitutionPair[] {
  const seen = new Set<string>();
  const pairs: SubstitutionPair[] = [];

  const add = (ingredient: string, substitute: string, ratio: number) => {
    const key = `${ingredient}→${substitute}`;

    if (ingredient === substitute || seen.has(key)) {return;}

    seen.add(key);
    pairs.push({ ingredient, ratio, substitute });
  };

  for (const group of SUBSTITUTION_GROUPS) {
    for (const ingredient of group.members) {
      for (const substitute of group.members) {add(ingredient, substitute, 1);}
    }
  }

  for (const extra of SUBSTITUTION_EXTRAS) {add(extra.from, extra.to, extra.ratio ?? 1);}

  return pairs;
}
