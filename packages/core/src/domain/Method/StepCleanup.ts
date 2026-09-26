/**
 * What a model writes anyway, cleaned up before a step reaches anyone.
 *
 * Measured on 72 dishes each from `google/gemma-4-31b-it` and
 * `deepseek/deepseek-v4.1-flash` (prompt 4.2.0, reasoning none), asked for
 * steps in Spanish: DeepSeek came back clean — 100% carried `minutes`, 0%
 * carried a backtick. Gemma left the schema's own field name inside 69% of
 * its step texts ("durante 12 `minutes`"), named ingredients by their
 * catalogue slug in 48% ("Tueste la rebanada de pan-integral…"), and its
 * cues came back in English inside a Spanish recipe ("until the rice is
 * tender"). Telling the model harder (`PROMPT_VERSION` 4.3.0) is the first
 * line; this is the guarantee, the same reasoning as the allergy gate
 * (`docs/decisions/0004-deterministic-safety-layer.md`) — a written rule is a
 * request, and nothing here trusts the model to have followed it.
 *
 * Runs in `PoolBuilder`, on every generated dish, after the schema parse and
 * the slug repair and before any gate: a step's ingredients must already be
 * *this dish's* final slugs when this reads them, so a repaired slug is read
 * back as its own catalogue name and not the one the model wrote.
 */

/** A step as the model wrote it, or as far as this module's own passes have carried it. */
export type GeneratedStep = { readonly cue?: string; readonly minutes?: number; readonly text: string };

export type StepCleanupOptions = {
  /**
   * The catalogue slug a step's text or cue may echo, mapped to its display
   * name, already lower case ("pan-integral" → "pan integral"). Every slug
   * this dish's request could have shown the model, whatever it actually
   * used — a name absent from the map is left exactly as written, which is
   * what keeps "medio-alto" untouched: it is a real word, never a slug.
   */
  readonly ingredientNames: ReadonlyMap<string, string>;
  /**
   * The locale the dish was asked for, as `PoolPrompt.languageName` reads it
   * ('es-ES', 'en-GB', …). Only a non-English locale is checked for English
   * prose — an English-locale dish has nothing to be caught by the rule that
   * exists to keep two languages from mixing in the first place.
   */
  readonly locale: string;
};

/** English by its locale prefix, the same test `languageName` is keyed by. */
function isEnglishLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('en');
}

const MINUTE_WORD: Record<'en' | 'es', { readonly plural: string; readonly singular: string }> = {
  en: { plural: 'minutes', singular: 'minute' },
  es: { plural: 'minutos', singular: 'minuto' }
};

function minuteWord(locale: string, value: number): string {
  const words = isEnglishLocale(locale) ? MINUTE_WORD.en : MINUTE_WORD.es;

  return value === 1 ? words.singular : words.plural;
}

/**
 * The English word for the field itself, left inside the prose it should
 * only ever have named in code — with or without the backticks a model wraps
 * a field name in. Matched only right after the number it times, which is
 * where every stored instance of the bug sits.
 */
const MINUTE_PLACEHOLDER = /(\d+)(\s*)`?(minutes?)`?\b/gi;

/** Every backtick a model wraps a field name or a slug in; none belongs in a step a person reads. */
function stripBackticks(text: string): string {
  return text.replace(/`/g, '');
}

/** A number followed by the bare English field name, in either language, turned into a word of the dish's own. */
function fixMinutePlaceholder(text: string, locale: string): string {
  return text.replace(MINUTE_PLACEHOLDER, (_match, value: string, space: string) => `${value}${space}${minuteWord(locale, Number(value))}`);
}

/** A run of letters, digits and internal hyphens — the shape of a slug, and of nothing else this should touch. */
const TOKEN = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

/** Every token that is exactly a known slug, read back as the ingredient's own name; anything else is untouched. */
function replaceSlugTokens(text: string, names: ReadonlyMap<string, string>): string {
  return text.replace(TOKEN, token => names.get(token.toLowerCase()) ?? token);
}

/** One request's worth of general clean-up, common to a step's text and its cue. */
function cleanProse(text: string, options: StepCleanupOptions): string {
  return replaceSlugTokens(fixMinutePlaceholder(stripBackticks(text), options.locale), options.ingredientNames);
}

/** A duration this text states, in minutes: an hour is sixty. */
const DURATION = /\b(\d+)\s*(horas?|hours?|h|minutos?|minutes?|min)\b/giu;

function durationMinutes(value: number, unit: string): number {
  const lower = unit.toLowerCase();

  return lower.startsWith('hora') || lower.startsWith('hour') || lower === 'h' ? value * 60 : value;
}

/**
 * `minutes` from the text, when — and only when — it states exactly one
 * duration. Zero told nothing; more than one would be a guess at which one
 * the field means, and this never guesses.
 */
function singleDuration(text: string): number | undefined {
  const matches = [...text.matchAll(DURATION)];

  if (matches.length !== 1) {
    return undefined;
  }

  const match = matches[0];
  const value = match[1] ?? '0';
  const unit = match[2] ?? '';

  return durationMinutes(Number(value), unit);
}

/**
 * A small, deliberately conservative net: two hits, or an opening "until ",
 * catch the bug this exists for — a whole sentence or cue written in
 * English — without reading typical Spanish prose as a false positive. A
 * step that merely contains one of the words on its own ("the", "is") is not
 * caught; a sentence built out of them is.
 */
const ENGLISH_STOPWORDS: ReadonlySet<string> = new Set(['and', 'into', 'is', 'it', 'the', 'until', 'with']);

function looksEnglish(text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  if (trimmed.startsWith('until ')) {
    return true;
  }

  const words = trimmed.match(/[a-z']+/g) ?? [];
  let hits = 0;

  for (const word of words) {
    if (ENGLISH_STOPWORDS.has(word)) {
      hits += 1;

      if (hits >= 2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * One step, cleaned — or `null` when its *text* reads as English in a
 * non-English request, which is not a step this rewrites but a dish this
 * rejects (`PoolBuilder` turns `null` into `wrong_language`).
 *
 * A cue is smaller and optional, so an English cue is simply dropped rather
 * than taken as reason to reject a dish whose actual method is fine.
 */
export function cleanStep(step: GeneratedStep, options: StepCleanupOptions): GeneratedStep | null {
  const english = isEnglishLocale(options.locale);
  const text = cleanProse(step.text, options);

  if (!english && looksEnglish(text)) {
    return null;
  }

  const cleanedCue = step.cue ? cleanProse(step.cue, options) : undefined;
  const cue = cleanedCue && !(!english && looksEnglish(cleanedCue)) ? cleanedCue : undefined;
  const minutes = step.minutes ?? singleDuration(text);

  return { ...(cue === undefined ? {} : { cue }), ...(minutes === undefined ? {} : { minutes }), text };
}

/**
 * A whole dish's steps, cleaned in order — or `null` the moment one of them
 * reads as English, which rejects the dish rather than serving it half
 * cleaned.
 */
export function cleanSteps(steps: readonly GeneratedStep[], options: StepCleanupOptions): readonly GeneratedStep[] | null {
  const cleaned: GeneratedStep[] = [];

  for (const step of steps) {
    const result = cleanStep(step, options);

    if (result === null) {
      return null;
    }

    cleaned.push(result);
  }

  return cleaned;
}
