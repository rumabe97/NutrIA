import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';
import monkConfig from './monk.js';
import { config as baseConfig, restrictedSyntaxJsx } from './base.js';
import { Linter } from 'eslint';

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * `baseConfig` already pulls in `js.configs.recommended`, `eslintConfigPrettier`, and
 * `tseslint.configs.recommended` — don't re-spread them here.
 *
 * @type {Linter.Config} */
export const config = [
  ...baseConfig,
  ...monkConfig,
  pluginReact.configs.flat.recommended,
  {
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser
      }
    }
  },
  {
    plugins: {
      'react-hooks': pluginReactHooks
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // Replaces (not merges with) the base entry, so it must carry the base selectors too —
      // hence the composed `restrictedSyntaxJsx` export.
      'no-restricted-syntax': ['error', ...restrictedSyntaxJsx],
      'react/function-component-definition': ['error', { namedComponents: 'function-declaration', unnamedComponents: 'function-expression' }],
      'react/jsx-boolean-value': ['error', 'always'],
      // `element` form: `<Fragment>…</Fragment>` imported from 'react', never `<>…</>`.
      // Coexists with `react/jsx-no-useless-fragment`: that rule flags fragments wrapping a
      // single child regardless of syntax; this one only dictates which syntax to use.
      'react/jsx-fragments': ['error', 'element'],
      // React scope no longer necessary with new JSX transform.
      'react/react-in-jsx-scope': 'off',
      // Empty interfaces that extend a single type are a valid pattern for naming component props.
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }]
    }
  }
];
