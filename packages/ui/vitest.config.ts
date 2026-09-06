import react from '@vitejs/plugin-react';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      exclude: [
        'src/components/**/index.ts',
        'src/utils/**/index.ts',
        'src/**/*.d.ts',
        'src/**/*.types.ts',
        'src/types/**',
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.test.{ts,tsx}'
      ],
      include: ['src/**/*.{ts,tsx}'],
      provider: 'istanbul',
      reporter: [['text', { skipFull: false }], 'html', 'json-summary'],
      // Calibrated to current coverage with ~1% headroom. Adding a new untested component
      // will likely fail this gate — write the tests, don't lower the numbers. Branches sits
      // lower than the rest because defensive `?.` and early-return arms are hard to fully
      // exercise without contriving tests just to hit them.
      thresholds: {
        branches: 80,
        functions: 94,
        lines: 93,
        statements: 91
      }
    },
    // CSS modules normally produce hashed class names (`Button_root__abc123`). Under tests we
    // expose the unscoped names (`root`) so `expect(el).toHaveClass('root')` can verify that
    // the className prop and the internal class compose correctly on the right element.
    // This is for testing the prop contract (className forwarding), not visual styling —
    // see the "Testing className composition" subsection in AGENTS.md.
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    },
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.ts']
  }
});
