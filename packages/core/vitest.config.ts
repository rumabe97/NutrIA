import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/**/index.ts', 'src/**/*.d.ts', 'src/**/*.test.ts'],
      include: ['src/**/*.ts'],
      provider: 'istanbul',
      reporter: [['text', { skipFull: false }], 'html', 'json-summary']
    },
    environment: 'node',
    globals: false
  }
});
