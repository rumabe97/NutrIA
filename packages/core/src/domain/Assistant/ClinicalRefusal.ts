import { normaliseForMatching } from 'core/domain/Safety';

/**
 * What kind of clinical question a lexicon match is: the situations
 * `PRODUCT.md` § Users sends to a professional, plus doses and medication.
 */
export type ClinicalCategory = 'child' | 'condition' | 'dose' | 'eating_disorder' | 'medication' | 'pregnancy';

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
      'statins'
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
      'insuficiencia renal',
      'enfermedad renal',
      'dialisis',
      'fenilcetonuria',
      'quimioterapia',
      'diabetic',
      'kidney disease',
      'dialysis',
      'chemotherapy'
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
 */
export function clinicalRefusal(question: string): ClinicalCategory | null {
  const text = ` ${normaliseForMatching(question)} `;

  for (const [category, terms] of LEXICON) {
    if (terms.some(term => has(text, term))) {
      return category;
    }
  }

  return CHILD.some(term => has(text, term)) && FEEDING.some(term => has(text, term)) ? 'child' : null;
}
