import type { KnipConfig } from 'knip';

// NOTE: knip uses the MOST SPECIFIC matching workspace block only — a specific block
// (e.g. 'packages/core') REPLACES the glob block ('packages/*'), it does not merge with
// it. Every specific block must therefore repeat the generic entries it still needs.
//
// And in `--production` mode knip follows ONLY entries marked with a trailing `!`.
// An entry without it is invisible to the production run, which is the run `pnpm
// deadcode` performs — so a workspace whose real entry point is unmarked reports its
// whole source tree as dead. That is what happened to apps/api, which had no block at
// all and inherited `apps/*`, whose only entry is a lint config.
const config: KnipConfig = {
  ignoreExportsUsedInFile: true,
  workspaces: {
    'apps/*': {
      entry: ['eslint.config.js']
    },
    'apps/api': {
      // Two real entry points: `main.ts` boots the server locally, `api/index.ts` is the
      // handler Vercel invokes. Everything else is reached by following Nest's module
      // graph from `app.module.ts`.
      entry: ['eslint.config.js', 'src/main.ts!', 'src/api/index.ts!', 'scripts/*.mjs!', '.sweep.mjs!'],
      // The end-to-end suites and their harness are run by jest through
      // test/jest-e2e.json, which `--production` does not follow.
      ignore: ['test/**']
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
      entry: ['eslint.config.js']
    },
    'configurations/eslint': {
      entry: ['base.js!', 'node.js!', 'next.js!', 'react-internal.js!', 'monk.js!']
    },
    'packages/core': {
      // The three export maps in package.json, plus the repositories. The repositories are
      // NOT public — controllers reach them through the `#repositories/*` imports map — but
      // knip does not resolve subpath imports, so without naming them here it reports the
      // whole internal layer as dead and `drizzle-orm` as an unused dependency.
      entry: [
        'eslint.config.js',
        'src/controllers/*/index.ts!',
        'src/domain/*/index.ts!',
        'src/entities/*/index.ts!',
        'src/repositories/*/index.ts!'
      ],
      // Test fixtures are consumed by *.test.ts files, which `--production` excludes.
      ignore: ['src/test/**']
    },
    'packages/database': {
      // drizzle plugin disabled: it executes drizzle.config.ts, which throws without a real
      // DIRECT_DATABASE_URL — the config file and its deps are ignored instead.
      drizzle: false,
      entry: [
        'eslint.config.js',
        'src/client.ts!',
        'src/schemas/index.ts!',
        'src/schemas/*.schema.ts!',
        'src/seed/index.ts!',
        'scripts/*.ts!'
      ],
      ignoreDependencies: ['dotenv', 'drizzle-kit'],
      ignore: ['drizzle.config.ts']
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
