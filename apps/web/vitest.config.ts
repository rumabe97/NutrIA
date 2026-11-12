import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/** `tsconfig.json`'s `paths`, for the few tests that render a component. */
const source = (folder: string) => fileURLToPath(new URL(`./src/${folder}`, import.meta.url));

/**
 * Mirrors `packages/ui`'s setup. Pure modules under `src/lib` are most of what is
 * covered — see `apps/web/AGENTS.md` § Testing for what belongs here and what does
 * not. A component whose markup is a contract (the «IA» mark, a dish's designed
 * state) is rendered to a string with `react-dom/server`, in Node: no DOM library.
 */
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      components: source('components'),
      hooks: source('hooks'),
      i18n: source('i18n'),
      lib: source('lib'),
      styles: source('styles')
    }
  },
  test: {
    coverage: {
      exclude: ['src/**/index.ts', 'src/**/*.d.ts', 'src/**/*.test.ts'],
      include: ['src/i18n/**/*.ts', 'src/lib/**/*.ts'],
      provider: 'istanbul',
      reporter: [['text', { skipFull: false }], 'html', 'json-summary']
    },
    environment: 'node',
    globals: false
  }
});
