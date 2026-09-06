import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';
import pluginNext from '@next/eslint-plugin-next';
import { config as baseConfig, restrictedSyntaxJsx } from './base.js';
import monkConfig from './monk.js';

import { Linter } from 'eslint';

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * `baseConfig` already pulls in `js.configs.recommended`, `eslintConfigPrettier`, and
 * `tseslint.configs.recommended` — don't re-spread them here.
 *
 * @type {Linter.Config}
 * */
export const nextJsConfig = [
  ...baseConfig,
  ...monkConfig,
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker
      }
    }
  },
  {
    plugins: {
      '@next/next': pluginNext
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      // `no-unused-vars` is disabled — `@typescript-eslint/no-unused-vars` (configured in base.js
      // with the underscore-prefix opt-out) supersedes it.
      'no-unused-vars': 'off',
      // Replaces (not merges with) the base entry, so it must carry the base selectors too —
      // hence the composed `restrictedSyntaxJsx` export.
      'no-restricted-syntax': ['error', ...restrictedSyntaxJsx],
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react/function-component-definition': ['error', { namedComponents: 'function-declaration', unnamedComponents: 'function-expression' }],
      'react/jsx-boolean-value': ['error', 'always'],
      // `element` form: `<Fragment>…</Fragment>` imported from 'react', never `<>…</>`.
      // Coexists with `react/jsx-no-useless-fragment`: that rule flags fragments wrapping a
      // single child regardless of syntax; this one only dictates which syntax to use.
      'react/jsx-fragments': ['error', 'element'],
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-no-undef': 'warn',
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-uses-react': 'warn',
      'react/jsx-uses-vars': 'warn',
      'react/no-array-index-key': 'error',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-multi-comp': 'error',
      'react/no-unused-state': 'warn',
      semi: ['error', 'always']
    }
  },
  {
    plugins: { 'react-hooks': pluginReactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      'react/react-in-jsx-scope': 'off'
    }
  }
];
