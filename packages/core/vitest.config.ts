import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  // The package's `exports` map points `default` at ./dist so Node and NestJS
  // can load compiled CommonJS. Tests must not: they would then assert against
  // the last build rather than the working tree. These aliases pull every
  // self-reference back to source.
  resolve: {
    alias: [
      { find: /^core\/(controllers|domain|entities)\/(.*)$/, replacement: `${src}/$1/$2/index.ts` },
      { find: /^#repositories\/(.*)$/, replacement: `${src}/repositories/$1/index.ts` },
      { find: /^#test\/(.*)$/, replacement: `${src}/test/$1.ts` }
    ]
  },
  test: {
    coverage: {
      exclude: ['src/**/index.ts', 'src/**/*.d.ts', 'src/**/*.test.ts', 'src/test/**'],
      include: ['src/**/*.ts'],
      provider: 'istanbul',
      reporter: [['text', { skipFull: false }], 'html', 'json-summary'],
      // Floors, not targets. The domain layer is the deterministic safety code —
      // allergy validation and nutrition maths — so it is held near-total.
      thresholds: { 'src/domain/**': { branches: 90, functions: 100, lines: 95, statements: 95 } }
    },
    environment: 'node',
    globals: false,
    // The scheduler and the plan validator are tested by searching — every portion, a whole
    // fortnight — so their tests are slow on purpose, and slower under coverage: about two
    // seconds each on a developer's machine, and 4.7s for one of them on CI's shared runner,
    // against a default limit of 5. One crossed it on `main` the day coverage became what
    // CI runs, after passing on the pull request an hour earlier. A limit that a correct
    // test reaches by chance is a coin, not a check. This one only ends a test that hangs.
    testTimeout: 30_000
  }
});
