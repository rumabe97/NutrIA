import { normaliseForMatching } from 'core/domain/Safety';

/**
 * Food supplements in a conversation with the assistant (`0108`): the four whose
 * usual amount it may say and the ceiling on each, everything else it may only
 * explain, what is not a supplement at all, and when an answer carries the fixed
 * notice.
 *
 * Every list is normalised (`normaliseForMatching`) and matched as whole words,
 * and everything here reads spelling — so none of it is a guarantee, the same
 * honesty as `clinicalRefusal`. What it buys: the notice does not depend on a
 * model remembering to write it, and the commonest ways an answer breaks the
 * rule («toma 4000 UI de vitamina D», «20 g de creatina la primera semana», «6 mg
 * de cafeína por kilo») are stopped by code.
 */

/** The four an amount may be said for (the owner, 2026-11-16), each with the words that name it. */
const AMOUNT_FAMILIES = {
  caffeine: ['cafeina', 'caffeine'],
  creatine: ['creatina', 'creatine', 'monohidrato', 'monohydrate'],
  omega3: ['omega 3', 'omega3', 'omega 3s', 'aceite de pescado', 'fish oil', 'epa', 'dha'],
  protein: [
    'proteina en polvo',
    'proteinas en polvo',
    'proteina de suero',
    'proteina whey',
    'batido de proteina',
    'batido de proteinas',
    'batidos de proteina',
    'batidos de proteinas',
    'whey',
    'caseina',
    'casein',
    'protein powder',
    'protein shake'
  ]
} as const;

type Family = keyof typeof AMOUNT_FAMILIES;

/**
 * The most the assistant may say of each, a day, in milligrams — the reference
 * the product's own label is held to, not a judgement of ours
 * (`docs/legal/assistant-supplements.md` § 4.1): 3 g of creatine (RD 1487/2009,
 * annex), 400 mg of caffeine (EFSA 2015), 3 g of EPA and DHA. Protein powder has
 * none: it is food, and how much protein a serving carries is a nutritional
 * figure the label gives and the figure check withholds (`0105`).
 */
export const SUPPLEMENT_CEILINGS_MG: Readonly<Record<Exclude<Family, 'protein'>, number>> = { caffeine: 400, creatine: 3000, omega3: 3000 };

/**
 * Supplements the assistant explains and never gives an amount for: vitamins,
 * minerals, and everything sold beside the four — the label's amount, or a
 * professional's.
 */
const NO_AMOUNT = [
  'vitamina',
  'vitaminas',
  'vitamin',
  'vitamins',
  'd3',
  'k2',
  'b12',
  'acido folico',
  'folic acid',
  'folato',
  'folate',
  'hierro',
  'iron',
  'magnesio',
  'magnesium',
  'zinc',
  'calcio',
  'calcium',
  'yodo',
  'iodine',
  'selenio',
  'selenium',
  'potasio',
  'potassium',
  'melatonina',
  'melatonin',
  'colageno',
  'collagen',
  'ashwagandha',
  'probiotico',
  'probioticos',
  'probiotic',
  'probiotics',
  'pre entreno',
  'preentreno',
  'pre workout',
  'preworkout',
  'beta alanina',
  'beta alanine',
  'citrulina',
  'citrulline',
  'bcaa',
  'bcaas',
  'aminoacidos ramificados',
  'glutamina',
  'glutamine',
  'carnitina',
  'l carnitina',
  'carnitine',
  'taurina',
  'taurine',
  'sinefrina',
  'synephrine',
  'espirulina',
  'spirulina',
  'curcuma',
  'curcumina',
  'curcumin',
  'turmeric',
  'berberina',
  'berberine',
  'levadura de arroz rojo',
  'red yeast rice',
  'monacolina',
  'ginseng',
  'maca',
  'coenzima q10',
  'q10'
];

/** A supplement by its own name, whatever is in it. */
const GENERIC = ['complemento alimenticio', 'complementos alimenticios', 'multivitaminico', 'multivitaminicos', 'multivitamin', 'multivitamins'];

/** «suplemento», «suplementarte», «supplementation»: every form of the word, which no list of endings would hold. */
const GENERIC_STEM = / (?:suplement|supplement)/u;

/** The shape a supplement comes in — which is also what tells «un comprimido aporta 400 mg» from «un yogur aporta 150 mg». */
const PILL = [
  'capsula',
  'capsulas',
  'comprimido',
  'comprimidos',
  'pastilla',
  'pastillas',
  'gragea',
  'grageas',
  'capsule',
  'capsules',
  'tablet',
  'tablets',
  'pill',
  'pills'
];

/** A food and what it carries: the sentence a nutrition label would write. */
const FOOD = [
  'tiene',
  'tienen',
  'lleva',
  'llevan',
  'aporta',
  'aportan',
  'contiene',
  'contienen',
  'dan',
  'alimento',
  'alimentos',
  'contains',
  'contain',
  'provides',
  'provide',
  'food',
  'foods'
];

/** Somebody taking something, in every form of the verb: «tomo», «tomar», «se toma», «take». Wide on purpose — a notice too many harms nobody. */
const INTAKE = / (?:tom[a-z]*|take|takes|taking) /u;

/** An amount for a day, rather than of an ingredient. */
const DAILY = ['al dia', 'diario', 'diarios', 'diaria', 'diarias', 'cada dia', 'por toma', 'a day', 'per day', 'daily', 'each day'];

/**
 * What is not a food supplement and is never discussed as one: medicines,
 * substances banned in sport, and substances banned in food
 * (`docs/legal/assistant-supplements.md` § 4.2, where each has its source). Named
 * in a question, it is refused before any model is called (`clinicalRefusal`).
 */
export const BANNED_SUBSTANCES = [
  'esteroide',
  'esteroides',
  'anabolizante',
  'anabolizantes',
  'steroid',
  'steroids',
  'testosterona',
  'testosterone',
  'nandrolona',
  'nandrolone',
  'stanozolol',
  'oxandrolone',
  'androstenedione',
  'estanozolol',
  'winstrol',
  'oxandrolona',
  'anavar',
  'trembolona',
  'trenbolone',
  'metandienona',
  'dianabol',
  'prohormona',
  'prohormonas',
  'prohormone',
  'prohormones',
  'androstenediona',
  'dhea',
  'prasterona',
  'sarm',
  'sarms',
  'ostarina',
  'ostarine',
  'enobosarm',
  'ligandrol',
  'lgd 4033',
  'rad140',
  'rad 140',
  'andarina',
  's 23',
  's23',
  'yk 11',
  'clembuterol',
  'clenbuterol',
  'dnp',
  'dinitrofenol',
  'dinitrophenol',
  'bpc 157',
  'hormona de crecimiento',
  'growth hormone',
  'hgh',
  'gh',
  'erythropoietin',
  'igf 1',
  'epo',
  'eritropoyetina',
  'efedrina',
  'ephedrine',
  'pseudoefedrina',
  'metilefedrina',
  'pseudoephedrine',
  'efedra',
  'ephedra',
  'yohimbina',
  'yohimbe',
  'yohimbine',
  'dmaa',
  'metilhexanamina',
  'dmha',
  'octodrina',
  'dimetilhexilamina',
  'octodrine',
  'methylhexanamine',
  'bmpea',
  'oxilofrina',
  'metilsinefrina',
  'sibutramina',
  'sibutramine',
  'higenamina',
  'higenamine',
  'quemagrasas',
  'quemagrasa',
  'fat burner',
  'fat burners',
  'post ciclo',
  'postciclo'
];

/** An amount in milligrams, micrograms or grams, with its number. */
const AMOUNT = /(\d+(?:[.,]\d+)*)\s?(mg|mcg|ug|µg|μg|miligramos?|microgramos?|milligrams?|micrograms?|g|gr|gramos?|grams?)\b/giu;

/** International units are a vitamin's alone: an amount in them is withheld wherever it is written. */
const INTERNATIONAL_UNITS = /\d+(?:[.,\s]\d+)*\s?(?:ui|iu|unidades internacionales|international units)\b/iu;

/** «por kilo», «/kg», «per kilo of body weight»: an amount fitted to the person, which is not the assistant's to work out. */
const PER_KILO = /^[^.!?\n]{0,40}?(?:\bpor\s+(?:cada\s+)?(?:kilo|kg)\b|\/\s?kg\b|\bper\s+(?:kilo|kg)\b)/iu;

const ALL_FAMILY_TERMS = Object.values(AMOUNT_FAMILIES).flat();

function has(text: string, term: string): boolean {
  return text.includes(` ${term} `);
}

function names(text: string, terms: readonly string[]): boolean {
  return terms.some(term => has(text, term));
}

function padded(text: string): string {
  return ` ${normaliseForMatching(text)} `;
}

function unaccented(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function generic(text: string): boolean {
  return GENERIC_STEM.test(text) || names(text, GENERIC);
}

type Subject = 'none' | Family;

/** The listed thing named last in a padded text — a family, something with no amount, or null. */
function lastNamed(text: string): Subject | null {
  let found: Subject | null = null;
  let at = -1;

  for (const [family, terms] of Object.entries(AMOUNT_FAMILIES) as [Family, readonly string[]][]) {
    for (const term of terms) {
      const index = text.lastIndexOf(` ${term} `);

      if (index > at) {
        at = index;
        found = family;
      }
    }
  }

  for (const term of NO_AMOUNT) {
    const index = text.lastIndexOf(` ${term} `);

    // On a tie the longer name wins: «proteína en polvo» and nothing inside it.
    if (index > at) {
      at = index;
      found = 'none';
    }
  }

  return found;
}

/** What the words straight after an amount say it is an amount of: «de creatina», «of magnesium», or an ingredient nobody listed. */
function namedAfter(after: string): 'unlisted' | Subject | null {
  const text = padded(after.split(/[.!?\n;:()]/u)[0] ?? '').slice(0, 40);
  const lead = [' de ', ' of ', ' '];
  const starts = (terms: readonly string[]) => terms.some(term => lead.some(word => text.startsWith(`${word}${term} `)));

  for (const [family, terms] of Object.entries(AMOUNT_FAMILIES) as [Family, readonly string[]][]) {
    if (starts(terms)) {
      return family;
    }
  }

  if (starts(NO_AMOUNT)) {
    return 'none';
  }

  return text.startsWith(' de ') || text.startsWith(' of ') ? 'unlisted' : null;
}

/**
 * The four, alone: a sports supplement the assistant may give an amount for is
 * named, and nothing it may not — the one case a question may ask «¿qué dosis?»
 * (`clinicalRefusal`). `epa` and `dha` do not count as naming one: «Epa, ¿qué
 * dosis de paracetamol tomo?» is not a question about omega-3.
 */
export function asksOnlyOfSportsSupplements(question: string): boolean {
  const text = padded(question);

  return (
    names(
      text,
      ALL_FAMILY_TERMS.filter(term => term !== 'epa' && term !== 'dha')
    ) &&
    !names(text, NO_AMOUNT) &&
    !names(text, BANNED_SUBSTANCES)
  );
}

/**
 * Whether an exchange is about a supplement — which attaches the notice and
 * turns the amount check on.
 *
 * `asked` is what the person asked: this question and, in a thread, the one
 * before it, so «¿y cuánto se toma?» is read with what it follows.
 *
 * A vitamin or a mineral in a question about food does not make it so («¿cuánto
 * calcio tiene el yogur?», «¿qué alimentos tienen hierro?»). Asked about on its
 * own it does («¿para qué sirve el magnesio?»); so does anybody taking it,
 * whatever else the question says («¿tomo el hierro con alimentos?», «¿cuánta
 * vitamina D tiene que tomar un adulto?»); and so does either side naming a
 * supplement as such.
 */
export function isAboutSupplements(asked: string, answer: string): boolean {
  const question = padded(asked);
  const said = padded(answer);

  return (
    names(question, ALL_FAMILY_TERMS) ||
    generic(question) ||
    names(said, ALL_FAMILY_TERMS) ||
    generic(said) ||
    (names(question, NO_AMOUNT) && (!names(question, FOOD) || INTAKE.test(question)))
  );
}

function milligrams(number: string, unit: string): number {
  // «2.000», «2,000»: a thousands separator when three digits follow it; a decimal otherwise.
  const value = Number(/^\d{1,3}(?:[.,]\d{3})+$/u.test(number) ? number.replace(/[.,]/gu, '') : number.replace(',', '.'));
  const normalised = normaliseForMatching(unit);

  if (/^(?:g|gr|gramos?|grams?)$/u.test(normalised)) {
    return value * 1000;
  }

  return /^(?:mg|miligramos?|milligrams?)$/u.test(normalised) ? value : value / 1000;
}

/**
 * The amount of a supplement an answer states that is not the assistant's to
 * give, or null — the answer is withheld on one (`0108` clauses 2 and 3):
 *
 * - any amount in international units, wherever it is written;
 * - any amount per kilo of body weight;
 * - more than the ceiling of creatine, caffeine or omega-3 (`SUPPLEMENT_CEILINGS_MG`);
 * - any amount at all of anything else.
 *
 * An amount belongs to what the words after it name («400 mg de magnesio»); or,
 * failing that, to the supplement named last before it in its own sentence, then
 * in the answer, then in what was asked — so «La vitamina D ayuda al hueso. Lo
 * habitual son 25 µg al día» states an amount of vitamin D though the sentence
 * that carries it names nothing.
 *
 * Grams are read narrowly, because a recipe is full of them: of creatine and
 * omega-3 against their ceiling, and of anything else only straight before its
 * name («1 g de vitamina C») or beside a word for a day. A food and what it
 * carries («un yogur aporta 150 mg de calcio») is a label, not an amount to
 * take, and passes.
 *
 * Not a guarantee: «una cápsula al día» and «el doble de lo que pone» state an
 * amount this cannot read. The prompt forbids them and the notice follows them.
 */
export function withheldSupplementAmount(asked: string, answer: string): string | null {
  const said = unaccented(answer);
  const units = INTERNATIONAL_UNITS.exec(said);

  if (units) {
    return units[0];
  }

  if (!isAboutSupplements(asked, answer)) {
    return null;
  }

  const question = padded(asked);
  let offset = 0;

  for (const sentence of said.split(/(?<=[.!?\n])/u)) {
    const text = padded(sentence);
    // «Un yogur aporta 150 mg de calcio»: what a food carries. Not when it comes in a pill, nor when it is said for a day.
    const label = names(text, FOOD) && !names(text, PILL) && !generic(text) && !names(text, DAILY);

    for (const match of sentence.matchAll(AMOUNT)) {
      const [whole, number = '', unit = ''] = match;
      const after = sentence.slice(match.index + whole.length);
      const grams = /^g/iu.test(unit);
      const next = namedAfter(after);
      const subject =
        next !== null && next !== 'unlisted'
          ? next
          : (lastNamed(padded(sentence.slice(0, match.index))) ?? lastNamed(padded(said.slice(0, offset))) ?? lastNamed(question));

      // An ingredient of a recipe, or of a shake: «30 g de avena», «300 ml de leche».
      if (grams && next === 'unlisted') {
        continue;
      }

      if (subject !== null && subject !== 'none' && subject !== 'protein' && next !== 'unlisted') {
        if (PER_KILO.test(after) || milligrams(number, unit) > SUPPLEMENT_CEILINGS_MG[subject]) {
          return whole;
        }

        continue;
      }

      // Protein powder is food and has no ceiling — but an amount of it per kilo is fitted to the person all the same.
      if (subject === 'protein' && next !== 'unlisted') {
        if (PER_KILO.test(after)) {
          return whole;
        }

        continue;
      }

      // From here: something with no amount, something nobody listed, or nothing named at all.
      if (label) {
        continue;
      }

      if (!grams || next === 'none' || (subject === 'none' && names(text, DAILY))) {
        return whole;
      }
    }

    offset += sentence.length;
  }

  return null;
}

/** The notices code attaches to an answer; the words are the web app's, like a decline's. */
export const ASSISTANT_NOTICES = ['supplement'] as const;

export type AssistantNotice = (typeof ASSISTANT_NOTICES)[number];

/** The notice an answer is shown with: the supplement one whenever the exchange is about a supplement and something was answered. */
export function noticeFor(asked: string, answer: string): AssistantNotice | null {
  return answer.trim() !== '' && isAboutSupplements(asked, answer) ? 'supplement' : null;
}
