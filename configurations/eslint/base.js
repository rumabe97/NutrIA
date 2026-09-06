import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';

// Shared options for every perfectionist rule: plain alphabetical, ascending, by name.
// Import ORDER is intentionally not handled here — `monk/imports` owns it (see monk.js).
const alphabetical = { type: 'alphabetical', order: 'asc' };

// Object-shaped rules additionally pin `id` before everything else. Database schemas and
// entity zod objects read better with the identifier leading, and one repo-wide convention
// beats path-scoped overrides.
const idFirst = {
  ...alphabetical,
  customGroups: [{ groupName: 'id', elementNamePattern: '^id$' }],
  groups: ['id', 'unknown']
};

// Unions read payload-first, fallback-last: `User | undefined`, not `undefined | User`.
// `nullish` is perfectionist's built-in selector for `null` and `undefined`.
const nullishLast = {
  ...alphabetical,
  groups: ['unknown', 'nullish']
};

// Unions made up ENTIRELY of numeric string literals sort numerically, not lexically:
// '1' | '2' | … | '10', instead of '1' | '10' | '11' | '2'. Mixed unions don't match
// the pattern and fall through to the default alphabetical config.
const numericLiterals = {
  ...alphabetical,
  type: 'natural',
  useConfigurationIf: { allNamesMatchPattern: "^'\\d+'$" }
};

// Unions made up ENTIRELY of size-scale literals keep semantic order (xs → 3xl), not
// alphabetical. The full scale is listed even though the template only uses xs–xl today:
// a token missing here would make the whole union silently fall back to alphabetical.
const SIZE_SCALE = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', '2xl', '3xl'];
const sizeLiterals = {
  ...alphabetical,
  useConfigurationIf: { allNamesMatchPattern: `^'(${SIZE_SCALE.join('|')})'$` },
  groups: SIZE_SCALE,
  customGroups: SIZE_SCALE.map(size => ({ groupName: size, elementNamePattern: `^'${size}'$` }))
};

// Shared `no-restricted-syntax` selectors. Exported because in flat config a later
// `no-restricted-syntax` entry silently REPLACES an earlier one instead of merging —
// configs that extend this base (next.js, react-internal.js) must spread these into
// their own entry rather than declaring the rule from scratch.
export const restrictedSyntax = [
  {
    selector: "ImportDeclaration[source.value='react'] ImportNamespaceSpecifier",
    message:
      "Don't use `import * as React from 'react'`. Use named imports — `import { useState, type ReactElement } from 'react'` — they're tree-shakable and refactor-friendly."
  },
  {
    selector: 'VariableDeclarator ObjectPattern ObjectPattern',
    message: 'No nested destructuring — take one level per statement: `const { data } = await x();` then `const { user } = data;`.'
  },
  // Module-scope functions (utils, helpers outside a component) are named `function`
  // declarations — they're the file's structural units and hoisting lets them sit in
  // reading order. Arrows stay for values INSIDE functions/components (handlers,
  // callbacks): they're per-render values, they keep TypeScript's null-narrowing from
  // enclosing guards (hoisted declarations don't), and they can be annotated with a
  // function type (`const f: SomeCallback = …`). Deliberately scoped to the top level
  // only — `func-style` can't express this split, hence these selectors instead.
  {
    selector: 'Program > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
    message: 'Module-scope functions are `function` declarations. Arrows are for values inside components/functions (handlers, callbacks).'
  },
  {
    selector: 'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
    message: 'Module-scope functions are `function` declarations. Arrows are for values inside components/functions (handlers, callbacks).'
  }
];

// The base selectors plus the JSX-only ones. For configs that lint JSX (next.js,
// react-internal.js) — their `no-restricted-syntax` entry replaces the base one, so it
// must carry everything.
export const restrictedSyntaxJsx = [
  ...restrictedSyntax,
  {
    selector: "JSXExpressionContainer > LogicalExpression[operator='&&']",
    message:
      'Use a ternary with explicit null instead of `&&`: `{cond ? <X /> : null}`. (Not react/jsx-no-leaked-render — it ignores comparison left-hand sides like `items.length > 0 && …`, which is exactly the case to catch.)'
  }
];

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    // Enable typed linting — typescript-eslint uses the Project Service to auto-discover
    // each package's tsconfig.json so the no-unsafe-* rules can access type information.
    languageOptions: {
      parserOptions: {
        projectService: true
      }
    }
  },
  { plugins: { turbo: turboPlugin }, rules: { 'turbo/no-undeclared-env-vars': 'warn' } },
  { plugins: { onlyWarn } },
  {
    plugins: { perfectionist },
    rules: {
      'perfectionist/sort-enums': ['error', alphabetical],
      'perfectionist/sort-interfaces': ['error', idFirst],
      'perfectionist/sort-jsx-props': ['error', alphabetical],
      'perfectionist/sort-named-exports': ['error', alphabetical],
      'perfectionist/sort-named-imports': ['error', alphabetical],
      'perfectionist/sort-object-types': ['error', idFirst],
      'perfectionist/sort-objects': ['error', idFirst],
      // First matching `useConfigurationIf` wins; `nullishLast` has no condition and is the fallback.
      'perfectionist/sort-union-types': ['error', numericLiterals, sizeLiterals, nullishLast]
    }
  },
  {
    rules: {
      // Hard rule: `any` is never allowed. Use `unknown` + narrowing instead.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      // Allow underscore-prefixed names for intentionally-unused vars, args, and destructured
      // bindings. The pattern is standard across the TS ecosystem (the TS compiler's own
      // `noUnusedParameters` already respects it). Defined once here so the rule can't drift
      // between the per-framework configs that extend this base.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      // Force `import type { X } from 'y'` over the inline `import { type X } from 'y'` form,
      // and over importing types alongside runtime values in the same statement. The separate-
      // import form is unambiguous and cleanly disappears at compile time.
      //
      // This rule is load-bearing because `configurations/typescript/base.json` sets
      // `verbatimModuleSyntax: true` — without the `type` keyword on a type-only import,
      // TypeScript emits the import as a runtime require, which then crashes under bundlers
      // that strip unused types (esbuild's `isolatedModules` mode, Turbopack). Keeping the
      // lint rule + tsconfig setting in sync prevents that whole class of "works in IDE,
      // breaks in build" failure.
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      // Forbid `import React from 'react'` (default) and `import * as React from 'react'`
      // (namespace). Use named imports: `import { useState, type ReactElement } from 'react'`.
      // The `React.foo` namespace style is a legacy pattern from before the new JSX transform
      // and predates ESM tree-shaking — named imports are sharper, easier to refactor, and
      // produce smaller bundles.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['default'],
              message:
                "Use named imports from 'react' instead — `import { useState } from 'react'`. The default React import isn't needed with the new JSX transform."
            }
          ]
        }
      ],
      'no-restricted-syntax': ['error', ...restrictedSyntax]
    }
  },
  {
    // Blank-line and block-shape conventions. This object sits after `eslintConfigPrettier`
    // (spread near the top of the array), so nothing here gets disabled by it — and none of
    // these rules conflict with Prettier anyway: Prettier preserves blank lines between
    // statements rather than managing them.
    plugins: { '@stylistic': stylistic },
    rules: {
      // Every `if`/`else`/loop body gets braces — no single-line guards.
      curly: ['error', 'all'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        // No blank line between a 'use client'/'use server' directive and the first import.
        { blankLine: 'never', prev: 'directive', next: '*' }
      ]
    }
  },
  { ignores: ['dist/**'] }
];
