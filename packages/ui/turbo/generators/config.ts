import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PlopTypes } from '@turbo/gen';

// Generators for the UI design system. See packages/ui/AGENTS.md for what each one produces
// and the conventions the templates encode. Run via:
//
//   pnpm --filter ui generate:component        (or `pnpm generate:component` from the root)
//   pnpm --filter ui generate:hook             (or `pnpm generate:hook` from the root)
//
// These are convenience generators — AI agents and humans who know the canonical shape
// (documented in packages/ui/AGENTS.md) are free to create components by hand. The
// generator's main value is (a) handling the boilerplate atomically and (b) updating
// Navigation.tsx with the new entry in alphabetical position.
//
// Docs: https://turborepo.com/docs/guides/generating-code

function toDisplayName(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
}

function toKebabCase(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// Inserts the new component into UI_NAV's "Components" items array and re-sorts the whole
// group alphabetically by display name. No marker needed — we parse the array directly.
//
// Format preserved: two-space indentation on the items array (matching the rest of the file),
// trailing comma on all but the last entry, single quotes for strings.
function updateNavigation(componentName: string): string {
  // __dirname is packages/ui/turbo/generators — go up four levels to the workspace root.
  const navPath = resolve(__dirname, '../../../../apps/docs/src/components/Navigation/Navigation.tsx');
  const nav = readFileSync(navPath, 'utf-8');

  // Match the Components group's items array. The pattern is intentionally narrow —
  // `title: 'Components'` followed by `items: [` then any content up to the first `]`
  // that closes that array. Other groups (Layout, Typography, Basics) are unaffected.
  const blockRegex = /(title: 'Components',\s*items:\s*\[)([\s\S]*?)(\n {6}\])/;
  const match = nav.match(blockRegex);
  if (!match) {
    throw new Error('Could not find the Components group in Navigation.tsx — the file structure may have changed. Update the generator regex or restore the expected shape.');
  }

  const [, opener, body, closer] = match;

  // Extract existing items.
  const itemRegex = /\{\s*href:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'\s*\}/g;
  const items: Array<{ href: string; name: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(body)) !== null) {
    items.push({ href: m[1], name: m[2] });
  }

  // Add the new entry (skip duplicate hrefs — re-running the generator with the same
  // name is a no-op rather than a corruption).
  const newEntry = {
    href: `/ui/components/${toKebabCase(componentName)}`,
    name: toDisplayName(componentName)
  };
  if (!items.some(item => item.href === newEntry.href)) {
    items.push(newEntry);
  }

  // Sort alphabetically by display name. Uses localeCompare for predictable behaviour
  // across locales (the rest of the file's groups are sorted the same way).
  items.sort((itemA, itemB) => itemA.name.localeCompare(itemB.name));

  // Re-emit the items block with the matching indentation. Last item carries no comma —
  // matches the existing convention in this file (Toast was the last entry pre-generator).
  // The captured `closer` already includes the leading newline + 6 spaces + `]`, so the
  // new body only needs the leading newline and the items themselves.
  const lines = items.map((item, index) => {
    const trailing = index < items.length - 1 ? ',' : '';
    return `        { href: '${item.href}', name: '${item.name}' }${trailing}`;
  });
  const newBody = `\n${lines.join('\n')}`;

  writeFileSync(navPath, nav.replace(blockRegex, `${opener}${newBody}${closer}`));

  return `Modified Navigation.tsx — added "${newEntry.name}" (list kept sorted alphabetically).`;
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // Plop's built-in `titleCase` doesn't split PascalCase input (it leaves `GenTestCard` as-is).
  // This helper splits at uppercase boundaries so `MarbleEffect` becomes `Marble Effect` — the
  // form we use in Navigation entries and MDX headings.
  plop.setHelper('displayName', toDisplayName);

  // --- react-component ---------------------------------------------------------------------
  //
  // Adds a new component to packages/ui following the canonical shape documented in
  // packages/ui/AGENTS.md "Component structure". Produces five files atomically:
  //
  //   src/components/<Name>/<Name>.tsx           — implementation with ComponentPropsWithRef<'div'>
  //   src/components/<Name>/<Name>.module.css    — empty class stub, ready for tokenized styles
  //   src/components/<Name>/<Name>.test.tsx      — renders + className-forwarding assertions
  //   src/components/<Name>/index.ts             — barrel re-export
  //   apps/docs/src/content/ui/components/<kebab>.mdx
  //                                              — docs page (description / examples / props / a11y)
  //
  // And one in-place modification:
  //
  //   apps/docs/src/components/Navigation/Navigation.tsx
  //     — inserts the new entry into UI_NAV's "Components" group and re-sorts the group
  //       alphabetically by display name. No manual reordering needed.

  plop.setGenerator('react-component', {
    description: 'Add a new React component to packages/ui (canonical shape).',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Component name (PascalCase, e.g. "Card" or "MarbleEffect"):',
        validate: input => (/^[A-Z][A-Za-z0-9]*$/.test(input) ? true : 'Use PascalCase: "Card", "MarbleEffect", "RadioGroup".')
      }
    ],
    actions: [
      {
        type: 'add',
        path: 'src/components/{{pascalCase name}}/{{pascalCase name}}.tsx',
        templateFile: 'templates/component/Component.tsx.hbs'
      },
      {
        type: 'add',
        path: 'src/components/{{pascalCase name}}/{{pascalCase name}}.module.css',
        templateFile: 'templates/component/Component.module.css.hbs'
      },
      {
        type: 'add',
        path: 'src/components/{{pascalCase name}}/{{pascalCase name}}.test.tsx',
        templateFile: 'templates/component/Component.test.tsx.hbs'
      },
      {
        type: 'add',
        path: 'src/components/{{pascalCase name}}/index.ts',
        templateFile: 'templates/component/index.ts.hbs'
      },
      {
        type: 'add',
        path: '../../apps/docs/src/content/ui/components/{{kebabCase name}}.mdx',
        templateFile: 'templates/component/component.mdx.hbs'
      },
      (answers: unknown) => {
        const name = (answers as { name: string }).name;
        return updateNavigation(name);
      },
      () =>
        'Done. Next steps:\n' +
        '  1. Implement the component body (replace the default <div> shell).\n' +
        '  2. Pick the right HTML tag in `ComponentPropsWithRef<\'tag\'>` if not <div>.\n' +
        '  3. Fill in the MDX page (description, examples, a11y).\n' +
        '  4. Delete the .module.css if the component ships no styles of its own.'
    ]
  });

  // --- hook --------------------------------------------------------------------------------
  //
  // Adds a new shared React hook to packages/ui/src/hooks/. Public hooks (exported via
  // `ui/hooks/*`) follow the folder + barrel shape — see packages/ui/AGENTS.md "File
  // structure for hooks, utils, and other named modules". Produces three files:
  //
  //   src/hooks/<useFoo>/<useFoo>.ts          — implementation stub
  //   src/hooks/<useFoo>/<useFoo>.test.ts     — placeholder test
  //   src/hooks/<useFoo>/index.ts             — barrel re-export
  //
  // For *internal-to-component* hooks (used only by one component), don't run this — drop
  // them into `src/components/<Component>/hooks/<useFoo>/` by hand. They follow the same
  // shape but aren't part of the package's public surface.

  plop.setGenerator('hook', {
    description: 'Add a new shared React hook to packages/ui/src/hooks/.',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Hook name (must start with "use", camelCase — e.g. "useMediaQuery"):',
        validate: input => (/^use[A-Z][A-Za-z0-9]*$/.test(input) ? true : 'Hooks must start with `use` followed by a capital letter: "useMediaQuery", "useDebouncedValue".')
      }
    ],
    actions: [
      {
        type: 'add',
        path: 'src/hooks/{{camelCase name}}/{{camelCase name}}.ts',
        templateFile: 'templates/hook/useHook.ts.hbs'
      },
      {
        type: 'add',
        path: 'src/hooks/{{camelCase name}}/{{camelCase name}}.test.ts',
        templateFile: 'templates/hook/useHook.test.ts.hbs'
      },
      {
        type: 'add',
        path: 'src/hooks/{{camelCase name}}/index.ts',
        templateFile: 'templates/hook/index.ts.hbs'
      },
      () =>
        'Done. Next steps:\n' +
        "  1. Implement the hook (replace the stub body).\n" +
        "  2. Drop the 'use client' directive if the hook doesn't call any client-only React API.\n" +
        '  3. Replace the placeholder test with real assertions.'
    ]
  });
}
