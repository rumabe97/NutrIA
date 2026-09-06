import type { KnipConfig } from 'knip';

// NOTE: knip uses the MOST SPECIFIC matching workspace block only — a specific block
// (e.g. 'packages/core') REPLACES the glob block ('packages/*'), it does not merge with
// it. Every specific block must therefore repeat the generic entries it still needs.
const config: KnipConfig = {
  ignoreExportsUsedInFile: true,
  workspaces: {
    'apps/*': {
      entry: ['eslint.config.js']
    },
    'apps/cli': {
      // `!` marks production entries so `--production` follows the import chain.
      entry: ['eslint.config.js', 'src/index.ts!']
    },
    'apps/docs': {
      // next.config.js loads @next/mdx at build time; `--production` skips config plugins,
      // so the MDX toolchain deps are invisible to it.
      entry: ['eslint.config.js', 'next.config.js!'],
      ignoreDependencies: ['@mdx-js/loader', '@mdx-js/react', '@next/mdx'],
      // MDX content is loaded by the [...slug] catch-all via a dynamic template-string
      // import knip cannot trace; examples and mdx-components are reached only from MDX.
      ignore: ['src/content/**', 'src/components/examples/**', 'mdx-components.tsx']
    },
    'apps/web': {
      entry: ['eslint.config.js'],
      // Starter shell: `core` is pre-wired for the first feature but not imported yet.
      ignoreDependencies: ['core']
    },
    'configurations/eslint': {
      entry: ['base.js', 'node.js', 'next.js', 'react-internal.js', 'monk.js']
    },
    'packages/core': {
      // Only controllers are public. Entities and repositories are internal implementation
      // details — knip reaches them by following the import chain from controllers.
      entry: ['eslint.config.js', 'src/controllers/*/index.ts'],
      // Test fixtures are consumed by *.test.ts files, which `--production` excludes.
      ignore: ['src/test/**']
    },
    'packages/database': {
      // drizzle plugin disabled: it executes drizzle.config.ts, which throws without a real
      // ADMIN_DATABASE_URL — the config file and its deps are ignored instead.
      drizzle: false,
      entry: ['eslint.config.js', 'src/seed.ts!'],
      ignoreDependencies: ['dotenv', 'drizzle-kit'],
      ignore: ['drizzle.config.ts', 'src/schemas/_utils.ts']
    },
    'packages/ui': {
      entry: ['eslint.config.js', 'turbo/generators/config.ts'],
      // vitest setup is wired via vitest.config.ts, which `--production` doesn't follow.
      ignore: ['test/**']
    },
    'packages/*': {
      entry: ['eslint.config.js', 'turbo/generators/config.ts']
    }
  }
};

export default config;
