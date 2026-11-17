import { normaliseForMatching } from 'core/domain/Safety';

import { asksOnlyOfSportsSupplements, BANNED_SUBSTANCES } from './Supplement';

/**
 * What kind of clinical question a lexicon match is: the situations
 * `PRODUCT.md` § Users sends to a professional, plus doses and medication — and
 * `banned`, what is sold as a supplement and is a medicine, or banned in sport
 * or in food (`BANNED_SUBSTANCES`).
 */
export type ClinicalCategory = 'banned' | 'child' | 'condition' | 'dose' | 'eating_disorder' | 'medication' | 'pregnancy';

/**
 * Terms, normalised (`normaliseForMatching`) and matched as whole words.
 *
 * Deliberately **not** here, though they look clinical: `mg` and `ml`, which a
 * nutrition label and a recipe use (`500 mg de sodio`, `200 ml de leche`);
 * `celiaco`, because coeliac disease is the one condition this product serves,
 * by exclusion (`0008`); `cancer`, which turns «¿el azúcar causa cáncer?» — a
 * nutrition question — into a refusal; `gota`, which is also a drop of oil.
 */
const LEXICON: readonly (readonly [ClinicalCategory, readonly string[]])[] = [
  // First, so that a sports supplement beside one of these never gets the benefit of the `dose` let-through below.
  ['banned', BANNED_SUBSTANCES],
  ['dose', ['dosis', 'dosificar', 'dosifico', 'posologia', 'pauta de insulina', 'dose', 'dosage']],
  [
    'medication',
    [
      'insulina',
      'metformina',
      'medicamento',
      'medicamentos',
      'medicacion',
      'pastilla',
      'pastillas',
      'farmaco',
      'farmacos',
      'antibiotico',
      'antibioticos',
      'anticoagulante',
      'sintrom',
      'warfarina',
      'levotiroxina',
      'eutirox',
      'estatina',
      'estatinas',
      'ibuprofeno',
      'paracetamol',
      'antidepresivo',
      'antidepresivos',
      'ozempic',
      'semaglutida',
      'liraglutida',
      'mounjaro',
      'tirzepatida',
      'insulin',
      'metformin',
      'medication',
      'medicine',
      'pill',
      'pills',
      'antibiotic',
      'warfarin',
      'statin',
      'statins',
      'ibuprofen',
      'antidepressant',
      'antidepressants'
    ]
  ],
  ['pregnancy', ['embarazo', 'embarazada', 'gestacion', 'gestante', 'lactancia', 'dando el pecho', 'pregnant', 'pregnancy', 'breastfeeding']],
  [
    'eating_disorder',
    [
      'anorexia',
      'bulimia',
      'trastorno alimentario',
      'trastorno de la conducta alimentaria',
      'tca',
      'atracon',
      'atracones',
      'purgar',
      'vomitar despues de comer',
      'eating disorder',
      'binge',
      'purge',
      'purging'
    ]
  ],
  [
    'condition',
    [
      'diabetes',
      'diabetico',
      'diabetica',
      'prediabetes',
      'hipertension',
      'hipertenso',
      'hipertensa',
      'insuficiencia renal',
      'enfermedad renal',
      'dialisis',
      'fenilcetonuria',
      'quimioterapia',
      'diabetic',
      'kidney disease',
      'dialysis',
      'chemotherapy',
      'hypertension'
    ]
  ],
  ['child', ['bebe', 'lactante', 'papilla', 'papillas', 'biberon', 'baby', 'infant', 'toddler']]
];

/** A child named in a question about feeding them — not merely a child in the sentence («receta para mis hijos»). */
const CHILD = ['hijo', 'hija', 'hijos', 'hijas', 'nino', 'nina', 'ninos', 'ninas', 'my son', 'my daughter', 'my child', 'my kid'];

const FEEDING = [
  'anos',
  'meses',
  'come',
  'comer',
  'no come',
  'dieta',
  'alimentacion',
  'alimentar',
  'peso',
  'years old',
  'months old',
  'eat',
  'eats',
  'diet',
  'feed'
];

function has(text: string, term: string): boolean {
  return text.includes(` ${term} `);
}

/**
 * The clinical lexicon, run on the question **before any model is called**
 * (PRD criterion 6, first layer).
 *
 * **What this is, and what it is not.** A pre-screen: it catches the obvious
 * question for nothing, and refuses it with the professional-review notice
 * without spending a call. It is **not a guarantee**, because it reads spelling
 * — «mi azúcar en sangre está alta», «tomo algo para el tiroides», «me pincho
 * por las noches» all pass it, and the tests say so by name. What catches a
 * paraphrase is the label (`clinical` is one of its values), and what catches
 * what both miss is the figure check: an answer of that kind needs a figure
 * nobody supplied.
 *
 * **One word is let through in one case** (`0108`): «dosis» beside one of the
 * four sports supplements and nothing else — «¿qué dosis de creatina tomo?» —
 * goes on to the label, because the usual amount of creatine, protein powder,
 * omega-3 or caffeine is something the assistant may now say. Beside a vitamin,
 * a mineral, any other supplement, a child or nothing, it is refused as before;
 * and every other category is read first or regardless, so «¿qué dosis de
 * creatina tomo con la metformina?» is still a medication question and «dosis
 * de creatina y clembuterol» a banned one.
 */
export function clinicalRefusal(question: string): ClinicalCategory | null {
  const text = ` ${normaliseForMatching(question)} `;

  // A dose asked for a child is a child's question whatever it is a dose of: no feeding word is needed.
  const letThrough = asksOnlyOfSportsSupplements(question) && !CHILD.some(term => has(text, term));

  for (const [category, terms] of LEXICON) {
    if (terms.some(term => has(text, term)) && !(category === 'dose' && letThrough)) {
      return category;
    }
  }

  return CHILD.some(term => has(text, term)) && FEEDING.some(term => has(text, term)) ? 'child' : null;
}
