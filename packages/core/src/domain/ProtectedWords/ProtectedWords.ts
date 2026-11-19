/**
 * The words a practitioner may not type (`0111` § 7, PRD 025 scope 5), as the
 * `legal` agent's words table lists them (`docs/legal/2026-11-18-anyone-can-open-a-practice.md`
 * § 6, approved by the owner on 2026-11-18 with choices C9 and § 6.4's two lists).
 *
 * One function, `protectedWordIn`, and every free-text field of a profile and
 * every label a practitioner can type goes through it with the badge as its
 * context (`ProfessionalBadgeRepository.badgeOf`). Pure: no I/O, no framework.
 *
 * **The decisive rule is the token, not the substring.** Two passes, in order:
 *
 * 1. **The raw text**, before anything is stripped: a number followed by `kg`,
 *    `kilo` or `kilos`, and `100 %` — a weight figure or a certainty reads as a
 *    promised result, refused for everybody. The word pass could never see them,
 *    because it turns digits into spaces.
 * 2. **The word pass**: lower case; the look-alike substitutions (`0→o`, `1→i`,
 *    `3→e`, `4→a`, `5→s`, `@→a`) only inside a token that also holds a letter, so
 *    «nutr1cionista» is caught and «1487» is left alone; accents stripped; every
 *    other non-letter (a hyphen, a dot, a slash, a digit) becomes a space. A listed
 *    word matches whole tokens, or a run of whole tokens: «nutricional» passes
 *    where «nutricionista» fails, and «d n» matches «D-N» and not the inside of
 *    «andén».
 *
 * What no list can judge — a disease offered as a service in other words, "without
 * effort" — is the owner's first look (§ 6.4), not this function's.
 */

/** Why a word is refused: only without the badge, for everybody, or as a promised result. */
export type ProtectedWordList = 'badge_only' | 'never' | 'result';

/** A refusal: the listed word as the table writes it (normalised), and its list. */
export interface ProtectedWordHit {
  readonly list: ProtectedWordList;
  readonly word: string;
}

/** Each Spanish adjective or noun with its feminine and both plurals: `colegiado` → four forms. */
function gendered(stem: string): readonly string[] {
  return [`${stem}o`, `${stem}a`, `${stem}os`, `${stem}as`];
}

/**
 * § 6.1, refused without the badge: the protected title, the collegiate claim,
 * the degree, the Latin American name of the profession (C9), the clinical
 * words, and § 6.4's condition names — a disease offered as a service — which
 * the owner adopted with the table ("a refusal costs an edit and a miss costs a
 * person"). «Nutri-cionista» is listed as its two tokens (§ 6.5's choice: caught
 * here rather than left to the first look).
 */
export const BADGE_ONLY_WORDS: readonly string[] = [
  // The title (Ley 44/2003 art. 2.2.b).
  'dietista',
  'dietistas',
  'nutricionista',
  'nutricionistas',
  'dietista nutricionista',
  'dietistas nutricionistas',
  'nutri cionista',
  'd n',
  'dn',
  'dietitian',
  'dietitians',
  'dietician',
  'dieticians',
  'nutritionist',
  'nutritionists',
  'registered dietitian',
  // The collegiate claim (PRD 025 criterion 5).
  ...gendered('colegiad'),
  'colegiacion',
  'n colegiado',
  'numero de colegiado',
  'num colegiado',
  'registered member',
  'registration number',
  // The degree.
  'nutricion humana y dietetica',
  'nhd',
  'grado en nutricion',
  'graduado en nutricion',
  'graduada en nutricion',
  'diplomado en nutricion',
  'diplomada en nutricion',
  'human nutrition and dietetics',
  // The same profession under its Latin American name (C9).
  ...gendered('nutriolog'),
  // Clinical words (CP 403.2.a; LCD 5.1.b).
  'consulta',
  'consultas',
  'paciente',
  'pacientes',
  'tratamiento',
  'tratamientos',
  'diagnostico',
  'diagnosticos',
  'diagnosticar',
  ...gendered('clinic'),
  ...gendered('terapeutic'),
  'terapia',
  'terapias',
  'patient',
  'patients',
  'treatment',
  'diagnosis',
  'diagnose',
  'clinical',
  'therapeutic',
  'therapy',
  'consultation',
  // § 6.4: a disease offered as a service, by the condition's own name.
  'diabetes',
  'hipertension',
  'colesterol',
  'celiaquia',
  'sop',
  'ovario poliquistico',
  'hipotiroidismo',
  'colon irritable',
  'reflujo',
  'gota',
  'renal',
  'embarazo',
  'lactancia',
  'anorexia',
  'bulimia',
  'tca',
  'obesidad',
  'cancer'
];

/** § 6.2, refused with or without the badge: titled professions NutrIA does not check in v1. */
export const NEVER_WORDS: readonly string[] = [
  'medico',
  'medica',
  'medicos',
  'medicas',
  'doctor',
  'doctora',
  'doctores',
  'doctoras',
  'dr',
  'dra',
  'physician',
  'md',
  ...gendered('endocrin'),
  ...gendered('endocrinolog'),
  'endocrinologist',
  ...gendered('enfermer'),
  'nurse',
  ...gendered('farmaceutic'),
  'pharmacist',
  ...gendered('psicolog'),
  'psicologo sanitario',
  'psicologa sanitaria',
  'psychologist',
  'tecnico superior en dietetica',
  'tecnica superior en dietetica',
  'tsd',
  'dietetic technician'
];

/** § 6.4, refused for everybody: a promised result in a word. The numeric ones are the raw pass's. */
export const RESULT_WORDS: readonly string[] = [...gendered('garantizad'), ...gendered('asegurad')];

/**
 * § 6.3, allowed — always beside the fixed notice the product renders for an
 * un-badged practitioner. Listed so its tests can prove none of them is refused.
 */
export const ALLOWED_WITH_NOTICE: readonly string[] = [
  'asesor de alimentacion',
  'asesora de alimentacion',
  'asesor nutricional',
  'asesora nutricional',
  'coach nutricional',
  'nutrition coach',
  'food adviser'
];

/** The raw pass: a weight figure (`10 kg`, `3,5kilos`) or a certainty (`100 %`), before digits become spaces. */
const RAW_RESULTS: readonly { readonly pattern: RegExp; readonly word: string }[] = [
  { pattern: /\d(?:[.,]\d+)?\s*(?:kgs?|kilos?)(?![\p{L}])/iu, word: 'kg' },
  { pattern: /(?<!\d)100\s*%/u, word: '100 %' }
];

/** Digits and signs that stand in for a letter inside a word: «nutr1cionista», «dieti$ta», «nutricionist@». */
const LOOK_ALIKES: Readonly<Record<string, string>> = { '!': 'i', '@': 'a', '|': 'i', $: 's', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's' };

/**
 * Cyrillic and Greek letters drawn like a Latin one: «diеtista» with a Cyrillic
 * «е» looks like «dietista» on every screen, so it is read as one here.
 */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  α: 'a',
  ε: 'e',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  а: 'a',
  в: 'b',
  ԁ: 'd',
  е: 'e',
  ѕ: 's',
  і: 'i',
  ј: 'j',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  ӏ: 'l'
};

/** Characters nobody sees — zero-width spaces and joiners, the soft hyphen, a byte-order mark — removed, never turned into a space. */
const INVISIBLE = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu;

/**
 * What every pass reads: compatibility forms folded (fullwidth «ｄｉｅｔｉｓｔａ»,
 * mathematical «𝐝𝐢𝐞𝐭𝐢𝐬𝐭𝐚», «º»), invisible characters removed, lower case, and
 * the look-alike letters of other scripts read as the Latin ones.
 */
function prepared(text: string): string {
  return [...text.normalize('NFKC').replace(INVISIBLE, '').toLowerCase()].map(char => HOMOGLYPHS[char] ?? char).join('');
}

/** One whitespace-separated token: its look-alike signs replaced only when it also holds a letter. */
function unmasked(token: string): string {
  return /\p{L}/u.test(token) ? [...token].map(char => LOOK_ALIKES[char] ?? char).join('') : token;
}

/** Accents stripped, every non-letter a space, split into tokens. */
function tokensOf(text: string): readonly string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(token => token.length > 0);
}

/** Every run of two or more one-letter tokens read as one word: «d i e t i s t a», «d.i.e.t.i.s.t.a». */
function joinedSingles(tokens: readonly string[]): readonly string[] {
  const joined: string[] = [];
  let run: string[] = [];

  const close = (): void => {
    joined.push(...(run.length > 1 ? [run.join('')] : run));
    run = [];
  };

  for (const token of tokens) {
    if (token.length === 1) {
      run.push(token);
    } else {
      close();
      joined.push(token);
    }
  }

  close();

  return joined;
}

/**
 * The word pass's normal form, as tokens: prepared, look-alike signs inside
 * lettered tokens, accents stripped, every non-letter a space.
 */
export function normalisedTokens(text: string): readonly string[] {
  return tokensOf(prepared(text).split(/\s+/u).map(unmasked).join(' '));
}

/**
 * Every reading a listed word is looked for in: the look-alike signs as letters
 * and as punctuation — so «consulta!» is still «consulta» — and each with its
 * spaced-out letters joined. A word found in any reading is refused.
 */
function readingsOf(text: string): readonly (readonly string[])[] {
  const plain = tokensOf(prepared(text));
  const signs = normalisedTokens(text);

  return [plain, signs, joinedSingles(plain), joinedSingles(signs)];
}

/** Whether `phrase` (already normal, space-separated) is a run of whole tokens in `tokens`. */
function holds(tokens: readonly string[], phrase: string): boolean {
  const words = phrase.split(' ');

  for (let start = 0; start + words.length <= tokens.length; start += 1) {
    if (words.every((word, offset) => tokens[start + offset] === word)) {
      return true;
    }
  }

  return false;
}

function firstOf(readings: readonly (readonly string[])[], words: readonly string[]): string | undefined {
  return words.find(word => readings.some(tokens => holds(tokens, word)));
}

/**
 * The first refused word in `text`, or null when it may be shown. `badged` is
 * whether the practitioner holds the badge **now** (`badgeOf`): with it, the
 * badge-only list is allowed and nothing else changes.
 *
 * Order: a promised result, then the words nobody may use, then the badge's own
 * — so the answer names the reason that would survive a badge.
 *
 * `judged` says what is being judged (invariant review of phase 6, round two):
 * a profile's text (`'text'`, the default) answers to all three lists; a
 * practitioner's **name** (`'name'`) to the titles alone — `never` and
 * `badge_only` — because a promised result is a rule for what a profile says,
 * and real surnames («Asegurado», «Garantizada») would hit it.
 */
export function protectedWordIn(text: string, badged: boolean, judged: 'name' | 'text' = 'text'): ProtectedWordHit | null {
  const tokens = readingsOf(text);

  if (judged === 'text') {
    const visible = prepared(text);
    const raw = RAW_RESULTS.find(({ pattern }) => pattern.test(visible));

    if (raw) {
      return { list: 'result', word: raw.word };
    }

    const result = firstOf(tokens, RESULT_WORDS);

    if (result !== undefined) {
      return { list: 'result', word: result };
    }
  }

  const never = firstOf(tokens, NEVER_WORDS);

  if (never !== undefined) {
    return { list: 'never', word: never };
  }

  const badgeOnly = badged ? undefined : (firstOf(tokens, BADGE_ONLY_WORDS) ?? titleStemIn(tokens));

  return badgeOnly === undefined ? null : { list: 'badge_only', word: badgeOnly };
}

/**
 * The protected **titles**, as a stem and the endings it takes, and the listed
 * word each stands for (invariant review of phase 6, P2-3). The token rule alone
 * let a title through when it was glued to another word or cut in pieces:
 * «dietistanutricionista», «dietistaNutricionista», a soft hyphen between the
 * two, «dieti sta», «diet ista», «die-tista», «nutricio nista».
 *
 * Two readings, both over every reading of the text:
 *
 * - **inside one token**, anywhere: no honest Spanish or English word holds one
 *   of these titles («dietética», «dieta», «nutrición», «nutricional» hold
 *   none), so a title glued to anything is the title;
 * - **across two to six adjacent tokens joined**, but only when the title **ends
 *   the run**: so «nu tri cio nis ta» is caught, and «Nutrición; istmo» —
 *   «nutricionistmo» — is not.
 *
 * § 6.3 of the words table passes untouched. Badge-only, like the titles.
 */
const TITLES: readonly { readonly pattern: RegExp; readonly tail: RegExp; readonly word: string }[] = [
  { endings: 'as|a', stem: 'dietist', word: 'dietista' },
  { endings: 'as|a', stem: 'nutricionist', word: 'nutricionista' },
  { endings: 's|', stem: 'dietitian', word: 'dietitian' },
  { endings: 's|', stem: 'dietician', word: 'dietician' },
  { endings: 's|', stem: 'nutritionist', word: 'nutritionist' },
  { endings: 'os|as|o|a', stem: 'nutriolog', word: 'nutriologo' }
].map(({ endings, stem, word }) => ({ pattern: new RegExp(`${stem}(?:${endings})`), tail: new RegExp(`${stem}(?:${endings})$`), word }));

/** The most adjacent tokens a title cut in pieces is looked for across. */
const TITLE_WINDOW = 6;

/** The listed title one token holds, or a run of adjacent tokens ends with — in any reading — or undefined. */
function titleStemIn(readings: readonly (readonly string[])[]): string | undefined {
  for (const tokens of readings) {
    for (let start = 0; start < tokens.length; start += 1) {
      for (let size = 1; size <= TITLE_WINDOW && start + size <= tokens.length; size += 1) {
        const joined = tokens.slice(start, start + size).join('');
        const hit = TITLES.find(title => (size === 1 ? title.pattern : title.tail).test(joined));

        if (hit) {
          return hit.word;
        }
      }
    }
  }

  return undefined;
}

/**
 * **The one judge of a practitioner's name shown to a client** (invariant
 * review of phase 6, round two): the name as it may be shown, or null when it
 * carries a title the account may not use now — `protectedWordIn` on the name,
 * titles only (`'name'`), with `badged` read as the caller reads it. Null is
 * rendered by the screens as the approved neutral «tu profesional» / "your
 * professional", and by a mail as its no-name variant. Used at the invitation,
 * the acceptance, the decline, the client's link and its endings — never on the
 * client's access trail, which keeps the name as it was when they were looked at.
 */
export function shownName(name: string, badged: boolean): string | null {
  return protectedWordIn(name, badged, 'name') === null ? name : null;
}
