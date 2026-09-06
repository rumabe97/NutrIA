import { createHighlighter } from 'shiki';
import { format } from 'prettier';

import type { Highlighter } from 'shiki';

// Shiki must be a singleton — it loads its WASM oniguruma engine and language
// grammars on each instance, which is expensive. We cache the *promise* (not
// the resolved highlighter) so concurrent callers all await the same in-flight
// init; storing on `globalThis` keeps the singleton alive across Turbopack
// HMR re-imports in dev. See: shiki warns at 10 instances.
const globalForShiki = globalThis as unknown as { __shikiHighlighter?: Promise<Highlighter> };

function getHighlighter(): Promise<Highlighter> {
  if (!globalForShiki.__shikiHighlighter) {
    globalForShiki.__shikiHighlighter = createHighlighter({
      langs: ['tsx', 'typescript', 'javascript', 'jsx', 'bash', 'css', 'json'],
      themes: ['github-light', 'github-dark']
    });
  }

  return globalForShiki.__shikiHighlighter;
}

const PRETTIER_PARSERS: Record<string, string> = {
  css: 'css',
  javascript: 'babel',
  js: 'babel',
  json: 'json',
  jsx: 'babel',
  ts: 'babel-ts',
  tsx: 'babel-ts',
  typescript: 'babel-ts'
};

async function formatCode(code: string, lang: string): Promise<string> {
  const parser = PRETTIER_PARSERS[lang];

  if (!parser) {
    return code;
  }

  try {
    return (await format(code, { parser, printWidth: 80, singleQuote: true, trailingComma: 'all' })).trimEnd();
  } catch {
    return code;
  }
}

export interface HighlightResult {
  code: string;
  html: string;
}

export async function highlight(code: string, lang = 'tsx'): Promise<HighlightResult> {
  const [formatted, hl] = await Promise.all([formatCode(code.trim(), lang), getHighlighter()]);
  const html = hl.codeToHtml(formatted, { lang, themes: { dark: 'github-dark', light: 'github-light' } });

  return { code: formatted, html };
}
