# Template bug — `configurations/eslint` declares its plugins as devDependencies

> **Purpose**: a writeup destined for the `trc-template` repository, not for this one.
> Delete once shipped. **Committed**: yes (the outbox is committed; see AGENTS.md § Rules).

**Destination**: `therootkitcompany/trc-template`
**Found**: 2026-09-06, during this workspace's kickoff.

## Symptom

`pnpm lint` fails in every package of a fresh template clone:

```
$ eslint 'src/**/*.{ts,tsx,js,jsx}' --max-warnings 0
sh: line 1: eslint: command not found
```

`pnpm turbo lint` therefore fails for the whole workspace, and `pnpm format` fails the same
way for `prettier`.

## Cause

`configurations/eslint/package.json` lists `eslint`, `typescript-eslint`, every
`eslint-plugin-*` and `globals` under **`devDependencies`**. Those config files `import`
those packages at runtime, so they are dependencies of the config package, not dev
dependencies of it — and pnpm does not install a workspace dependency's devDependencies for
consumers.

Second, related problem: pnpm links only a *direct* dependency's binaries into a package's
`node_modules/.bin`. Even with the classification fixed, `eslint-configuration` provides the
config but not the `eslint` executable the lint script invokes.

## Fix

1. In `configurations/eslint/package.json`, move everything except `typescript` from
   `devDependencies` to `dependencies`.
2. Add `eslint` (and `prettier`, for the `format` scripts) to the `devDependencies` of every
   package that has a `lint` / `format` script.

## Second finding — CSS Modules resolve to `any`

`apps/web/src/globals.d.ts` and `apps/docs/src/globals.d.ts` declare `*.css` but not
`*.module.css`. `import styles from './X.module.css'` therefore resolves to `any`, which
silently disables every type-aware lint rule on the file. Once lint actually runs, this
surfaces as ~117 warnings in `apps/docs` alone.

`packages/ui/src/global.d.ts` already has the correct declaration; the two apps need the
same block:

```ts
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
```
