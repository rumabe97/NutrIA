import { defineConfig } from 'vitest/config';

/**
 * Mirrors `packages/ui`'s setup. Only pure modules under `src/lib` are covered
 * today — see `apps/web/AGENTS.md` § Testing for what belongs here and what does
 * not.
 */
export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/**/index.ts', 'src/**/*.d.ts', 'src/**/*.test.ts'],
      include: ['src/lib/**/*.ts'],
      provider: 'istanbul',
      reporter: [['text', { skipFull: false }], 'html', 'json-summary']
    },
    environment: 'node',
    globals: false
  }
});
