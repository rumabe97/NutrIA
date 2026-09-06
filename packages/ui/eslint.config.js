import { config } from 'eslint-configuration/react';

/**
 * Package-local ESLint config. Extends the shared `react` preset and adds rules that only
 * make sense inside `packages/ui`.
 *
 * @type {import("eslint").Linter.Config}
 */
export default [
  ...config,

  // --- Lock in the package self-reference convention ----------------------------------------
  //
  // packages/ui/AGENTS.md "Cross-directory imports" says: inside this package, anything that
  // crosses out of a component's own subtree (sibling components, top-level src/hooks,
  // src/utils, src/types, src/styles, src/fonts) must use the `ui/...` self-reference path,
  // not a relative `../../...` crossing. The rule is well-documented but easy to "fix" back
  // to a relative path on instinct — these two overrides catch the common mistakes.
  //
  // We deliberately split into two overrides because `no-restricted-imports` can't tell
  // "exiting the subtree" from "accessing the parent component's own hooks/utils" — the
  // legal depth depends on where the file lives. Each override duplicates the base
  // `paths` entry (the React default-import ban) because flat-config rule options are
  // replaced, not merged, when an override redefines the same rule.
  {
    // Top-level component files (`src/components/<Name>/<Name>.tsx`, `index.ts`,
    // `<Name>.test.tsx`). Any `../` from here leaves the component's own folder, so
    // cross-directory imports MUST use `ui/...`.
    files: ['src/components/*/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['default'],
              message: "Use named imports from 'react' instead — `import { useState } from 'react'`. The default React import isn't needed with the new JSX transform."
            }
          ],
          patterns: [
            {
              group: ['../**'],
              message: "Top-level component files mustn't use relative parent paths. Use the package self-reference — e.g. `import { Button } from 'ui/components/Button'` — see packages/ui/AGENTS.md → 'Cross-directory imports'."
            }
          ]
        }
      ]
    }
  },
  {
    // Sub-component files (`src/components/<Name>/components/<Child>/<Child>.tsx`, etc.).
    // Going up 1 or 2 levels stays inside the parent component's subtree (its `hooks/`,
    // `utils/`, `context.ts`, sibling sub-components). Going up 3+ levels exits the subtree
    // and must use `ui/...`.
    files: ['src/components/*/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['default'],
              message: "Use named imports from 'react' instead — `import { useState } from 'react'`. The default React import isn't needed with the new JSX transform."
            }
          ],
          patterns: [
            {
              group: ['../../../**'],
              message: "Sub-component files should only reach up to their parent component's subtree (≤ 2 levels). For sibling components or top-level dirs, use the package self-reference — `ui/components/<Name>` / `ui/hooks/<useFoo>` / `ui/utils/<foo>` / `ui/types/<Name>.types`."
            }
          ]
        }
      ]
    }
  }
];
