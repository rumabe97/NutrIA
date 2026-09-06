# packages/ui AGENTS.md

Component library for the monorepo. Rules here are more specific than the root `AGENTS.md` — both apply.

---

## What lives here

- `src/components/` — all reusable UI components (layout primitives `VStack`/`HStack`/`Flex`/`Grid`/`Container`/`Section`, typography `Heading`/`Text`/`Code`, plus everything else)
- `src/types/` — shared TypeScript types used by ≥2 components (e.g. `Sizes.types.ts`, `Space.types.ts`). Imported via `ui/types/<Name>.types`
- `src/hooks/` — shared React hooks (used in 2+ apps)
- `src/utils/` — shared utilities (used in 2+ apps)
- `src/styles/` — global token files (`colors.css`, `variables.css`, `base.css`, `classnames.css`)
- `src/fonts/` — font definitions

## Why we wrap Radix primitives (instead of re-exporting)

A lot of components in here (`AspectRatio`, `Avatar`, `Checkbox`, `Switch`, `Slider`, `Tabs`, `Accordion`, `Dialog`, `Drawer`, `Dropdown`, `RadioGroup`, `Select`, `Collapsible`, `ContextMenu`, etc.) are essentially thin pass-throughs over their Radix UI / vaul equivalents. The repetition is intentional, not laziness — every wrapper exists for at least one of these reasons:

1. **Consistent API surface.** Radix's component APIs vary by package age — some accept `asChild`, others don't; some expose `data-*` state attributes, others use ARIA. Our wrappers normalize the surface so consumers don't have to know whether `<Dialog>` is from `@radix-ui/react-dialog@1.1` or `@radix-ui/react-popover@2.0`.
2. **A stable styling hook.** Every wrapper that ships its own visuals attaches our CSS-module classes. If we re-exported Radix directly, callers would have to remember to apply the right `className` themselves — and we'd have no central place to enforce design-token usage. Pure passthroughs that don't ship visuals (e.g. `Tabs`, `ContextMenu`) skip the CSS module — see "When `.module.css` may be omitted" below.
3. **A swap point.** If a Radix primitive becomes problematic (deprecation, breaking change, a11y regression, license issue) we can rewrite the internals without breaking every consumer. Same shape goes out, different implementation goes in.
4. **A documented prop contract.** Radix exposes a *lot* of props; we narrow to the ones we actually want consumers to use, with our own JSDoc and our own conventions (e.g. `disabled`, `onCheckedChange`).

A wrapper that's "just" `<Root className={styles.root} {...rest} />` is doing all four of those things even if it doesn't look like much. Don't refactor these into a re-export.

## Framework coupling — this DS depends on Next.js

`packages/ui` has `next` as a runtime dependency (not just a dev dep). Two components extend Next-specific primitives:

- **`Image`** extends `next/image` — for automatic optimization (priority hints, blurDataURL, responsive `sizes`, etc.).
- **`Link`** extends `next/link` — for client-side route prefetching.

This is intentional in the current monorepo (every app is Next.js), and the integration earns its keep. But it's worth being explicit about the trade-off:

- **You cannot use this DS from a non-Next.js framework** (Remix, SolidStart, vanilla React) without first replacing `Image` and `Link` with framework-equivalents. The rest of the package is framework-agnostic.
- **If you publish this DS as a standalone npm package later**, drop the `next` dep and either remove `Image` / `Link` or expose them via a swappable injection mechanism (e.g. a `setImageComponent()` config at the consumer's root).

Don't add new Next-specific dependencies to other components without a similarly clear justification. Reaching for `next/font`, `next/dynamic`, or `next/headers` from a DS component would compound the coupling.

## Component structure

Every component follows this exact layout:

```
src/components/ComponentName/
  ComponentName.tsx         — implementation + props interface
  ComponentName.module.css  — scoped styles (omit if the component ships no styles of its own — see below)
  index.ts                  — re-export: export { ComponentName } from './ComponentName'
  components/               — sub-components (same structure, nested one level)
```

Do not flatten compound components into one file.

### When `.module.css` may be omitted

Add the CSS module file when the component has styles to scope. Skip it when there's nothing to put inside — empty CSS modules are noise. Components that legitimately ship without a `.module.css`:

- **Pure Radix/vaul passthroughs** that rely entirely on the underlying library's selectors (e.g. `Tabs`, `ContextMenu`).
- **SVG-only renderers** where all geometry is computed in TS and the component renders no DOM that needs CSS (e.g. `MarbleEffect`).
- **Third-party wrappers** that pass styling through prop hooks (e.g. `Toaster` styles via `toastOptions.style`).
- **Trivial primitives** with no styling surface (e.g. `Spacer`).

If you find yourself adding an empty `.module.css` "to follow the rule", don't — leave it out. Add the file the moment you have a real rule to write.

### Folder name = primary export name

The folder is named after the component it ships. Always. If the host export is `Toaster`, the folder is `Toaster/`, the file is `Toaster.tsx`, and the docs page slug can still be the feature name (`toast.mdx`) — but the code-side folder follows the export.

This is why the toast wrapper lives in `Toaster/`, not `Toast/`: the upstream lib (Sonner) exports `Toaster`, our wrapper preserves the name, and the folder matches.

### Sibling helper files (paired imperative APIs)

Some components ship with a paired imperative API — a function or factory that lives alongside the host component and is consumed from the same import path. The canonical example is `Toaster` + `toast()`:

```
src/components/Toaster/
  Toaster.tsx               — host component (renders the portal/region)
  Toaster.test.tsx
  toast.ts                  — imperative API (function the app calls many times)
  toast.test.ts
  index.ts                  — re-exports both: export { Toaster }; export { toast }
```

Rules:

- The helper filename matches its export (`toast.ts` exports `toast`).
- The helper has its own test file, named the same way (`toast.test.ts`).
- The barrel re-exports both — consumers import from `ui/components/Toaster`, not from sub-paths.
- Use this pattern only when the helper is **inseparable** from the host component's public API. A generic utility that happens to be used by one component belongs in `src/utils/`, not as a sibling.

### Allowed internal flat files (`constants.ts`, `context.ts`, `types.ts`)

Complex components may keep a small number of additional flat files at the component root for **internal-only** concerns that don't fit hooks or utils. The canonical example is Spotlight:

```
src/components/Spotlight/
  Spotlight.tsx
  Spotlight.module.css
  Spotlight.test.tsx
  constants.ts              — internal string constants (selectors, event names)
  context.ts                — React Context object creation (no hooks — those live in hooks/)
  types.ts                  — internal types shared across the component's files
  hooks/                    — component-internal hooks
  utils/                    — component-internal utils
  components/               — sub-components
  index.ts
```

Rules:

- These files are **not exported** by the package — they're internal plumbing for the component itself.
- Keep the set small: `constants.ts`, `context.ts`, `types.ts`. Anything beyond that probably wants to be a util, hook, or sub-component instead.
- If a "constant" or "type" turns out to be useful across multiple components, promote it to `src/types/` (shared types) — see [Shared types live in `src/types/<Name>.types.ts`](#shared-types-live-in-srctypesnametypests).
- Hooks that touch a Context go in `hooks/`, not in `context.ts`. `context.ts` is for `createContext()` calls only.

Most components won't need these files. They earn their keep when the component is large enough that inlining everything into `ComponentName.tsx` would obscure the implementation.

## File structure for hooks, utils, and other named modules

Two shapes coexist, picked by **kind**, not by visibility:

### Hooks — always folder + barrel

```
src/hooks/useComposedRefs/
  useComposedRefs.ts        — implementation
  useComposedRefs.test.ts   — colocated test
  index.ts                  — export { useComposedRefs } from './useComposedRefs'

src/components/Spotlight/hooks/useStore/
  useStore.ts               — internal-to-Spotlight hook
  index.ts                  — export { useStore } from './useStore'
```

The folder+barrel insulates consumers from internal refactors — when a hook grows from a single file into helpers + types, the import path stays stable. Hooks tend to grow more than utils (they import other hooks, sometimes split internally), so the structure pays off.

### Utils — always flat file

```
src/utils/
  composeRefs.ts            — implementation
  composeRefs.test.ts       — colocated test (no test for one-liners is fine)
  hashCode.ts
  hashCode.test.ts

src/components/Spotlight/utils/
  commandScore.ts           — internal-to-Spotlight util
  findNextSibling.ts
  findPreviousSibling.ts
  slottableWithNestedChildren.ts
```

No folder, no barrel, no `index.ts`. Utils are usually single pure functions that don't grow; the ceremony of a folder per util isn't worth it. **The grouping is the `utils/` folder, not a folder-per-symbol.**

**Why this works without losing refactor insulation**: TypeScript's `moduleResolution: "bundler"` resolves `from './utils/composeRefs'` to either `./utils/composeRefs.ts` OR `./utils/composeRefs/index.ts`, whichever exists. So if a util ever genuinely needs to grow into multiple files, convert it from flat to folder+barrel — **the import path stays identical**, no consumer changes. Flat is the cheap default; the upgrade is free when (rarely) needed.

### Where each goes

- **Top-level public surface** — `src/hooks/` and `src/utils/` — exposed via the `ui/hooks/*` and `ui/utils/*` export maps. App authors import these directly.
- **Component-internal** — `src/components/X/hooks/` and `src/components/X/utils/` — used only by component X. Not exported by the package.

Same kind-based rule applies in both locations. Hooks: folder. Utils: flat. **Promotion** (internal → public) is just moving the file or folder up to the top-level dir — same shape, same import-path pattern, no restructuring.

### Hook vs util — how to tell them apart

A **hook** is anything whose name starts with `use` and calls React's hook APIs (`useState`, `useEffect`, `useCallback`, `useRef`, `useContext`, `useSyncExternalStore`, etc.). It can only be called from a component or another hook.

A **util** is a pure function. It might take refs or ReactNodes as inputs (e.g. `composeRefs`, `slottableWithNestedChildren`), but it doesn't call any React hook itself, so it can be called from anywhere.

The split keeps the rules-of-hooks boundary explicit and makes it obvious from the import path whether a symbol is callable from event handlers and effects, or only from component-body / hook-body code.

### Other modules under `src/`

`src/fonts/`, `src/styles/`, `src/types/` keep their existing shapes — see the corresponding sections. Anything new that exposes a named symbol should follow the hooks-foldered / utils-flat rule based on kind.

The one exception: app-level entry points (`apps/cli/src/index.ts`, etc.) — these aren't barrels, they're the program's entry. Different role, different rules.

## Exports

- **Named exports only.** `export function ComponentName()` in the `.tsx` file.
- `index.ts` re-exports with: `export { ComponentName } from './ComponentName'`
- No default exports anywhere in this package.
- Compound components (e.g. `Dropdown`) export all sub-components from their `index.ts`:
  ```ts
  export { Dropdown } from './Dropdown';
  export { DropdownGroup } from './components/DropdownGroup';
  export { DropdownOption } from './components/DropdownOption';
  ```

## Props interface

```ts
import type { ComponentPropsWithRef } from 'react';

interface ComponentNameProps extends ComponentPropsWithRef<'div'> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}
```

- Always named `${ComponentName}Props`.
- **Extend `ComponentPropsWithRef<'tag'>`** for the tag the component renders by default (`'button'` for Button, `'input'` for Input, `'p'` for Text, `'div'` for VStack/HStack/etc.). The literal tag picks up element-specific attributes automatically — `'button'` adds `type`/`disabled`/`form`, `'input'` adds `pattern`/`required`/`type`, and so on — **plus** a correctly-typed `ref` prop. No separate `ref?: Ref<…>` declaration needed.
- Don't use the older `HTMLAttributes<HTMLElement>` / `ButtonHTMLAttributes<HTMLButtonElement>` / `DetailedHTMLProps<…>` forms — they're either weaker (no per-element typing) or noisier (double-named, include unwanted `key` in the spread).
- **Use `Omit<ComponentPropsWithRef<'tag'>, '…'>`** when you need to suppress specific native props that the component manages internally — `Omit<ComponentPropsWithRef<'input'>, 'id'>` is how `Input` blocks consumer-supplied `id` because it generates one via `useId` for label wiring.
- Simple prop defaults: inline in destructuring — `{ size = 'md', variant = 'primary' }`.
- Complex defaults (arrays, objects): `const DEFAULT_X = [...]` at the top of the same `.tsx` file. Never in a separate file.

### `interface` vs `type` for props

Convention: **`interface` for object/prop shapes; `type` for unions, intersections, and aliases that can't be expressed as interfaces.**

```ts
// ✅ Object shape — use interface (extensible, intent-clear, easy to add a prop later)
export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
}

// ✅ Empty interface that just aliases a Radix passthrough — still interface
export interface SwitchProps extends RadixSwitchProps {}

// ✅ Discriminated union — `type` is required (interfaces can't express `|`)
export type DropdownProps = OwnProps & ({ label: string; 'aria-label'?: string } | { label: ReactNode; 'aria-label': string });

// ✅ Intersection with a shared mixin — `type` is required (interfaces don't compose with `&` cleanly)
export type SectionProps = Omit<ComponentPropsWithRef<'section'>, 'aria-label' | 'aria-labelledby'> & SectionOwnProps & AccessibleName;

// ✅ Unions / scale literals — use `type`
type Size = 'sm' | 'md' | 'lg';
```

Why interface for object shapes: declarations merge cleanly, IDE hover reads as "ComponentNameProps interface" (clearer than "type alias"), and adding the first real prop doesn't require a syntactic rewrite. Reserve `type` for the cases where interface literally can't express the shape.

### Why `ComponentPropsWithRef` over the alternatives

React.dev itself doesn't prescribe a pattern. The [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/) — the de-facto community standard — recommends `ComponentPropsWithRef`: *"Use ComponentPropsWithRef to inherit all props from a native element."*

For a UI library specifically, `…WithRef` is the right default because:

- DS primitives are exactly the leaves consumers want to ref — focus a Button, measure a Container, attach an animation lib to an HStack. Making ref opt-out (rather than opt-in per-component) matches that reality.
- The variant resolves to the correctly-typed `ref` for the tag (`ComponentPropsWithRef<'input'>` → `Ref<HTMLInputElement>`). We don't have to re-declare it.
- Removing the manual `ref?: Ref<…>` line removes a place for type drift (the declared ref type silently disagreeing with the rendered element).

Use `ComponentPropsWithoutRef<'tag'>` only when you deliberately want to **block** consumers from passing a ref — extremely rare for a primitive.

### One nuance for polymorphic components (`as` prop)

Heading, Text, and the layout primitives accept an `as` prop. The `ref` typing in `ComponentPropsWithRef<'p'>` is locked to the default tag (`HTMLParagraphElement` for Text) — passing `as="span"` makes the published ref type technically loose. Properly-typed polymorphic refs require a multi-generic dance most DS's skip; we accept the imprecision as the cost of the `as` ergonomics.

### Refs are a regular prop (no `React.forwardRef`)

React 19 makes `ref` a regular prop. Accept it by destructuring like any other prop — and rely on `ComponentPropsWithRef<'tag'>` to type it for you:

```tsx
import type { ComponentPropsWithRef } from 'react';

// ✅ correct — ref already included by ComponentPropsWithRef<'div'>
interface MyComponentProps extends ComponentPropsWithRef<'div'> {
  variant?: 'primary' | 'secondary';
}

export function MyComponent({ ref, variant, ...rest }: MyComponentProps) {
  return <div ref={ref} {...rest} />;
}
```

```tsx
// ❌ wrong — don't use forwardRef in new code
export const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>((props, ref) => {
  return <div ref={ref} {...props} />;
});
```

`React.forwardRef` still works for back-compat but adds wrapping noise, makes display names brittle, and produces an opaque `ForwardRefExoticComponent` type. Plain function components with `ref` as a destructured prop are equivalent, simpler, and forward-compatible.

The one place `forwardRef` is referenced in this package — [Spotlight/utils.ts](src/components/Spotlight/utils.ts) — is **detection** code that handles consumers passing legacy `forwardRef` components into `asChild`. That's defensive back-compat, not us authoring with it.

## Styling

### Read the token catalog before writing CSS

The full token catalog lives in [`src/styles/variables.css`](src/styles/variables.css). Open it before authoring a component's CSS module — every reusable value is defined there. The families available:

| Family                           | Tokens                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Spacing (padding / margin / gap) | `--space-01` … `--space-12`                                                  |
| Font size                        | `--font-size-01` … `--font-size-11`                                          |
| Line height                      | `--line-height-01` … `--line-height-06`                                      |
| Font weight                      | `--font-weight-regular` / `medium` / `semibold` / `bold`                     |
| Component height                 | `--height-xs` / `s` / `m` / `l` / `xl`                                       |
| Radius                           | `--radius-01` … `--radius-05`, `--radius-full`                               |
| Surfaces                         | `--background-01` / `02` / `highlight`, `--color-glass`, `--color-overlay`   |
| Text                             | `--foreground-01` / `02` / `03` / `disabled`                                 |
| Border                           | `--border-01`                                                                |
| Interactive                      | `--color-hover`, `--color-highlighted`, `--color-selected`, `--color-switch` |
| State                            | `--color-success`, `--color-error`, `--color-warning`                        |
| Brand                            | `--color-brand-01` … `--color-brand-12`                                      |
| Shadow                           | `--shadow-s` / `m` / `l`                                                     |
| Focus ring                       | `--focus-ring-color` / `-width` / `-offset` (applied globally via `:focus-visible`) |
| Motion                           | `--duration-fast` / `normal` / `slow`, `--ease-default` / `spring`           |
| Z-index                          | `--z-base` / `dropdown` / `overlay` / `modal` / `toast` / `tooltip`          |

### When to tokenize vs. when raw is OK

**The principle: tokenize values that must coordinate across components; raw values are acceptable for geometry that is internal to one component.**

- **Must be a token** — anything where changing the value should ripple across the app: `color`, `background-color`, `border-color`, `border-radius`, `padding`, `margin`, `gap`, `font-size`, `font-weight`, `line-height`, `box-shadow`, `transition-duration`, `z-index`. Body text in Input must match body text in Button — that's why the scale exists.
- **Raw is OK** — values that exist only inside one component and have no cross-component contract: the `21px` Switch thumb, a `10px` checkmark SVG, a magic offset on an internal pseudo-element. Tokenizing these would invent false invariants (one-use `--switch-thumb-size` vars).
- **Rule of thumb:** if you'd want the value to change app-wide when the design changes, it's a token. If it's just "what this component happens to be," raw is fine.

### If the scale doesn't have the value you want

Don't reach for `0.9375rem` (15px) when the scale offers `0.875rem` (`--font-size-03`, 14px) and `1rem` (`--font-size-04`, 16px) — that's how scales decay into 30-value soup. Either pick the nearest tier or propose adding a new tier to `variables.css`. Never silently introduce a new size outside the scale.

### Other styling rules

- **No inline styles**, except in layout primitives (`VStack`, `HStack`, `Flex`, `Grid`, `Container`) where the value is a dynamic reference to a design token (e.g. `style={{ gap: \`var(--space-${gap})\` }}`). That is the only acceptable exception. `Section` is CSS-class-driven (`size` tier classes), not inline-styled.
- CSS class names driven by props via `styles[variant]` or `styles[size]` pattern.
- Import order in component files: CSS module first, then external, then internal:
  ```ts
  import styles from './ComponentName.module.css';
  import { useState } from 'react';
  import { OtherComponent } from 'components/OtherComponent';
  ```

## Client/server boundaries

**Don't add `'use client'` by default.** UI components stay context-agnostic so they can render on the server when used from a server component, and on the client when used from a client form. The interactivity boundary is the caller's responsibility, not the library's.

Only add `'use client'` when the component itself uses:

- `useState`, `useEffect`, `useReducer`, `useRef`, `useLayoutEffect`, `useImperativeHandle`
- Browser-only APIs (`window`, `document`, `localStorage`, `navigator`, etc.)
- Imperative DOM event listeners (e.g. `addEventListener` in an effect)

These hooks do **NOT** require `'use client'`: `useId`, `useMemo`, `useCallback`, `useContext`.

A component that just receives `onChange` / `onClick` as props and spreads them to DOM elements does **NOT** need `'use client'` — the parent passing the handler is already a client component, so the boundary is already drawn there.

Third-party UI libraries vary on this — check before assuming. Libraries that ship `'use client'` in their own source (Radix UI, vaul) propagate the directive through our wrapper, so **don't re-declare** it. Libraries that don't (Sonner is one) require us to **add** `'use client'` to the wrapper ourselves — otherwise importing the wrapper from a Server Component crashes at runtime. The rule isn't "Radix is special"; it's "match the upstream lib." When wrapping a new third-party client library, grep its `dist/` for `'use client'` to confirm which side of the rule you're on.

## Imports within packages/ui

There are two kinds of imports to know about, and they follow different rules.

### Same-directory imports — relative, no surprises

```ts
import styles from './Component.module.css';
import { SubComponent } from './components/SubComponent';
```

Always relative. No alias.

### Cross-directory imports — use the package's own name (`ui/...`)

When a component imports from another directory inside packages/ui (e.g. a shared type or another component), use the **package self-reference** path:

```ts
// ✅ correct — works from any consumer, including app-side typecheck
import type { Size } from 'ui/types/Sizes.types';
import type { SpaceScale } from 'ui/types/Space.types';
import { Heading } from 'ui/components/Heading'; // when a UI component composes another

// ❌ wrong — relative crossings drag `../../` around and reveal internal layout
import type { Size } from '../../types/Sizes.types';

// ❌ wrong — old `components/*` / `types/*` aliases only resolved inside packages/ui's own tsconfig.
// When an app imported the component, TypeScript followed source and failed to resolve these paths.
import type { Size } from 'types/Sizes.types';
```

The `ui/...` path resolves via `packages/ui/package.json`'s `exports` field — the **same mechanism apps use** to consume the package. Inside packages/ui, pnpm symlinks `ui` to itself in `node_modules`, so self-reference works. The result: **one consistent absolute-path rule for all consumers, including the package itself.**

Currently exported:

- `ui/components/*` → `./src/components/*/index.ts` — every component
- `ui/hooks/*` → `./src/hooks/*/index.ts` — every shared hook
- `ui/utils/*` → `./src/utils/*/index.ts` — every shared utility
- `ui/types/*` → `./src/types/*.ts` — every shared type
- `ui/fonts` → font definitions
- `ui/styles/*` → token/reset CSS

If you add a new top-level directory of importable code, add an entry to `exports` in `package.json` and reference it via `ui/<dir>/...`.

### Shared types live in `src/types/<Name>.types.ts`

Shared types (used by two or more components) go in `src/types/<Name>.types.ts`. Current examples: `SpaceScale` (spacing-scale-typed props), `Size` (size unions). Each component picks the subset it accepts via `Exclude`/`Extract`:

```ts
import type { Size } from 'ui/types/Sizes.types';

type ContainerSize = Exclude<Size, 'xs'>; // sm/md/lg/xl
type ButtonSize = Exclude<Size, 'xs' | 'xl'>; // sm/md/lg
```

This keeps the canonical scale in one file and lets each component opt in to the tiers it supports.

## Layout primitives — when to use which

The DS ships **seven** layout primitives. Each does one thing. The decision tree:

| Need                                                                     | Use                                                   | Why                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertical column of children with consistent spacing                      | **`VStack`**                                          | The 80% case. `<VStack gap="04">` is shorter than `<Flex direction="column" gap="04">`                                                                                                                                          |
| Horizontal row that wraps                                                | **`HStack`**                                          | Default wrap. Use for nav items, tag rows, button groups                                                                                                                                                                        |
| Explicit two-axis flex control (`direction`, `justify`, `align`, `wrap`) | **`Flex`**                                            | When VStack/HStack aren't enough — `justify="space-between"`, `*-reverse`, custom wrap                                                                                                                                          |
| Even N×N grid with consistent gap                                        | **`Grid`**                                            | `<Grid columns="3" gap="04">`. Drop to a CSS module for complex grids (areas, mixed tracks)                                                                                                                                     |
| Page-level max-width wrapper                                             | **`Container`**                                       | Sizes `sm` (640) / `md` (768) / `lg` (1024) / `xl` (1280). One per page, around your content                                                                                                                                    |
| Labelled page region with vertical rhythm                                | **`Section`**                                         | Always `<section>`, always requires `aria-label` or `aria-labelledby`, `size` controls vertical padding                                                                                                                         |
| A styled wrapper that recurs in 2+ places                                | Build a **named component** (`Card`, `Panel`, `Pill`) | One-off styled `<div>`? Just write the CSS in your component's module — don't reach for a generic wrapper                                                                                                                       |
| Gap between two siblings                                                 | **`VStack` / `HStack`** with `gap`                    | `Spacer` exists but is legacy. Use it only when you genuinely cannot wrap the siblings in a flex container (e.g. they come from different render contexts). Spacer's `space` prop is a raw rem number, not a `SpaceScale` token |

**Layout primitives do not expose visual styling props** (no `padding`, `background`, `radius`, `border`, etc.). Visual styles live in CSS modules. If a styled shape recurs, promote it to a dedicated named component (`Card`, `Panel`, `Pill`).

**Two exceptions** to the "no styling props" rule are deliberate:

- `gap` on VStack / HStack / Flex / Grid — gap is a between-children concern with no parent selector in CSS, so a prop is the only ergonomic way.
- `size` on Section — vertical rhythm is the whole reason Section exists; the size tiers are CSS-class-driven (not inline styles), so they don't compete with the CSS modules system.

Both props are typed against the design tokens, not raw values.

```tsx
import { VStack } from 'ui/components/VStack';
import { HStack } from 'ui/components/HStack';

<VStack gap="04">{children}</VStack>

<HStack gap="02" align="center">
  <Avatar />
  <span>Name</span>
</HStack>
```

`gap` is typed as `SpaceScale` (`'01'`–`'12'`), mapping to `--space-01`–`--space-12`. VStack and HStack both accept `align`, `justify`, `as`, and any HTML attribute. `HStack` also accepts `wrap` (default `true`).

## Typography primitives — when to use which

| Need                                                              | Use           | Why                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A semantic heading (h1–h6) with controlled visual size            | **`Heading`** | Decouples `level` (semantic tag) from `size` (visual scale). Same `<h2>` can be hero-large or card-tiny without breaking the outline                                                             |
| Paragraphs, captions, labels, fine print, or inline text          | **`Text`**    | Provides the body-text vocabulary (`size`, `weight`, `tone`, `align`). Renders `<p>` by default; use `as` for `<span>`, `<small>`, or semantic inline tags (`<strong>`, `<em>`, `<mark>`, `<s>`) |
| Inline code reference (`variant="primary"`, file paths, commands) | **`Code`**    | Monospace `<code>` with subtle background. Inline-only — see "When NOT to use" in [code.mdx](../../apps/docs/src/content/components/code.mdx) for block code guidance                            |

**Don't reach for raw `<h2>` / `<p>` / `<code>` in app code** when these primitives apply. The whole point of typography primitives is to centralize the size/weight/tone vocabulary so apps don't reinvent it. Raw HTML inside markdown content (MDX, blog posts) is fine — that's where the browser default styling lives — but in TSX you compose with these primitives.

> **MDX gotcha — `<Text>` and raw `<p>` inside MDX must have their children on one line.** MDX wraps multi-line content inside JSX in a `<p>` element; nesting that inside `<Text>` (which itself renders a `<p>`) produces `<p><p>…</p></p>`, invalid HTML and a React hydration error. Keep children inline. See [apps/docs/AGENTS.md](../../apps/docs/AGENTS.md) for the full rule and the JSX-expression escape hatch.

### Level vs. size decoupling — the central idea

`Heading`'s `level` chooses the **HTML tag** (`<h1>`–`<h6>`) — what screen readers and document-outline tools see. `size` chooses the **visual font-size** (`xs/sm/md/lg/xl`) — what users see. The two are independent because real interfaces routinely need them to disagree (e.g. a card title nested in a section should be `<h3>` semantically but small visually). Forcing them to match breaks either the outline or the design. Always pick `level` based on document structure; pick `size` based on visual hierarchy.

### Token mapping

- `Heading` sizes (`xs`–`xl`) map to `--font-size-05`–`--font-size-09` (18px → 36px)
- `Text` sizes (`xs`–`lg`) map to `--font-size-01`–`--font-size-04` (12px → 16px)
- Both default to a sensible line-height (`--line-height-02` for headings — tight; `--line-height-04` for text — comfortable)
- `tone` maps to `--foreground-01/02/03/disabled`; can be extended for semantic states — see the "Extending `tone`" section in [text.mdx](../../apps/docs/src/content/components/text.mdx)

## Accessibility primer

The DS is intentionally **a11y-neutral by default** — components don't enforce ARIA roles or focus management beyond what their underlying element provides. Accessibility is the caller's responsibility, but the DS surfaces the rules here so they're hard to miss.

### Landmark elements

ARIA landmarks let screen-reader users jump between major page regions. Eight HTML elements become landmarks automatically:

| Element                        | Landmark role   | Needs accessible name?                                           |
| ------------------------------ | --------------- | ---------------------------------------------------------------- |
| `<main>`                       | `main`          | No — should be unique per page                                   |
| `<header>` (child of `<body>`) | `banner`        | No — unique per page                                             |
| `<footer>` (child of `<body>`) | `contentinfo`   | No — unique per page                                             |
| `<nav>`                        | `navigation`    | Yes if **more than one** on the page (e.g. primary + footer nav) |
| `<aside>`                      | `complementary` | Yes if more than one                                             |
| `<article>`                    | `article`       | Yes if more than one                                             |
| `<section>`                    | `region`        | **Always** — without a name it's not actually a landmark         |
| `<search>`                     | `search`        | Yes if more than one                                             |
| `<form>`                       | `form`          | Only if named — otherwise it's a generic form (not a landmark)   |

**Provide accessible names via `aria-labelledby` (pointing at a visible heading) or `aria-label`.** A heading **inside** a `<section>` does _not_ auto-name the section — the algorithm only checks `aria-labelledby` → `aria-label` → `title`.

### `<header>` and `<footer>` are context-sensitive landmarks

`<header>` and `<footer>` only become landmarks (`banner` / `contentinfo`) when they are **direct children of `<body>`**. When nested inside `<article>`, `<section>`, `<aside>`, etc., they are **not landmarks** — they're still semantically meaningful (the article's header), they just don't appear in the screen-reader landmarks menu.

```tsx
<body>
  <header>…</header> {/* banner landmark — site-wide header */}
  <main>
    <article>
      <header>…</header> {/* not a landmark — article's own header, but semantic */}
      <p>…</p>
      <footer>…</footer> {/* not a landmark — article's footer */}
    </article>
  </main>
  <footer>…</footer> {/* contentinfo landmark — site-wide footer */}
</body>
```

**Use them either way.** Pick the semantically right tag for the content. Just be aware that nested header/footer doesn't add a landmark — if you want a nested region to be a landmark, use `<section>` with `aria-labelledby`.

### Section vs raw tag — when to use which

| Use case                                                    | Reach for                                                       | Why                                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A labelled page region with vertical rhythm                 | `<Section aria-labelledby="…">`                                 | Section is the only landmark primitive in the DS — enforces the name at the type level                            |
| A `<nav>` / `<aside>` / `<article>` / `<form>` / `<search>` | Write the tag directly                                          | These are app-specific shells with no DRY-worthy behavior. Add `aria-label` if you have more than one on the page |
| A `<main>` / `<header>` / `<footer>` (body-level)           | Write the tag directly                                          | Unique per page, no accessible name needed                                                                        |
| Vertical rhythm on a non-section element                    | A `<div>` (or appropriate semantic tag) with CSS module padding | Don't use Section just for the `size` prop — its contract is "labelled landmark"                                  |

The reason we don't build dedicated `<Nav>` / `<Aside>` / `<Article>` primitives: they would be one-line wrappers whose only value is TS-enforcing an aria prop. They have no shared geometry or behavior. Section earned its primitive status because it bundles vertical-rhythm tiers **and** the accessible-name enforcement.

### Other a11y obligations to know about

These aren't landmarks but they have specific requirements:

- **`<img>`** — `alt` is required. For decorative images use `alt=""`. The DS `Image` component extends `next/image`, which already requires `alt` at the TS level.
- **`<iframe>`** — `title` attribute is required to describe the embedded content.
- **`<dialog>` / modal** — needs `aria-labelledby` (or `aria-label`) plus focus management (trap focus while open, restore on close). The DS `Dialog`, `Drawer`, and `Sidebar` components handle all of this internally and require `title` at the prop level. They also accept an **optional `description`** prop: pass it when there's explanatory content the modal needs to convey to assistive tech (e.g. "Are you sure? This will permanently delete the project."). Skip it for simple confirmation modals where the title alone is enough. When omitted, the components explicitly opt out of `aria-describedby` so Radix/vaul don't warn — but if there's any explanatory copy in the modal body, prefer to surface it via `description` so it gets announced.
- **`<table>`** (data tables) — should include `<caption>`. We don't currently have a data-table primitive in the DS; if you build one, enforce caption.
- **`<video>` / `<audio>`** — provide captions or a transcript.
- **Interactive controls (`<button>`, `<a>`, form inputs)** — need an accessible name. For inputs, use a `<label>` (the DS `Input` requires `label` at the prop level). For icon-only buttons, add `aria-label`.
- **Active navigation links** — when a link points at the current page, add `aria-current="page"`. The DS `Link` accepts `aria-current` and forwards it. Screen readers announce "current page" so non-sighted users know where they are in the nav. CSS-only `.active` styling doesn't reach them.
- **Inline links in prose** — when a `Link` sits inside body text, set `inline` on it so it gets an underline + brand colour. WCAG 1.4.1 says colour alone can't identify a link; the default `Link` inherits its parent's style (good for nav, breadcrumbs, headers) so prose contexts must opt in to the visible affordance.
- **Loading regions** — `Spinner` and `Skeleton` are decorative by default (`aria-hidden`). For pages that load purely via these, wrap the loading region in `<div role="status" aria-live="polite" aria-label="Loading…">` so the parent announces the busy state **once**, instead of each skeleton announcing individually (which becomes "Loading… Loading… Loading…" noise). For single-indicator cases (e.g. a submit button), `Spinner` accepts an optional `label` prop that switches it to `role="status"` with a visually-hidden text node — use that when there's only one indicator and no parent loading region.

### Generate ARIA ids with `useId()` — never hardcode

When wiring `aria-labelledby`, `aria-describedby`, `aria-controls`, or any other ARIA reference that needs an id, **always generate the id with React's `useId()` hook**:

```tsx
import { useId } from 'react';

function PricingSection() {
  const headingId = useId();
  return (
    <Section aria-labelledby={headingId}>
      <Heading id={headingId} level="2">
        Pricing
      </Heading>
    </Section>
  );
}
```

Hardcoded strings like `aria-labelledby="pricing-heading"` look fine in a single example but **silently clash** the moment two instances of the same component render on one page. `useId` is stable across SSR and client hydration, and is one of the React hooks that does **not** require `'use client'` (see the Client/server boundaries section).

### Tab order vs. visual order

Tab order and screen-reader reading order follow the **DOM**, not the visual layout. Reordering with CSS (`flex-direction: row-reverse`, `order:`, `grid-row-start:`) creates a mismatch — sighted users see one order, assistive-tech users hear another. This violates [WCAG 2.1 SC 1.3.2 Meaningful Sequence](https://www.w3.org/WAI/WCAG21/Understanding/meaningful-sequence.html) whenever the visual order conveys meaning.

**Rule:** if order carries meaning (sequence, priority, agreement vs. cancellation), reorder the JSX, not the CSS. The Flex component's docs have a worked example.

## Testing

Test framework: **Vitest** + **@testing-library/react** + **@testing-library/user-event** + **jsdom**. Run from the root with `pnpm test` (orchestrated by Turborepo) or from `packages/ui` with `pnpm test` / `pnpm test:watch`.

### Where tests live

Test files **colocate with source**:

```
src/components/Carousel/
  Carousel.tsx
  Carousel.test.tsx          ← tests for the whole compound, here
  Carousel.module.css
  index.ts
  components/                ← sub-components are exercised through the compound's tests
```

For compound components, one test file at the root that uses the public API end-to-end is usually enough. Add per-sub-component test files only if the sub-component has logic worth isolating.

### What to test

Cover what users (and assistive tech) actually do:

- **Accessibility** — required ARIA roles, names, labels, `aria-current` / `aria-disabled` states, that `useX()` hooks throw when called outside their provider
- **Keyboard navigation** — arrow keys, Home/End, Enter/Space, tab order — using `userEvent.keyboard('{ArrowRight}')`
- **Pointer interaction** — `userEvent.click()` rather than raw `fireEvent.click` (it dispatches the realistic sequence of pointerdown / mousedown / focus / etc.)
- **Touch gestures** (where relevant) — `fireEvent.touch*` with explicit `timeStamp` via the `fireTouch` helper pattern in `Carousel.test.tsx`
- **Hook contracts** — render the hook with `renderHook()` and a wrapper, assert on `result.current`

Skip:

- **Pure styling** — asserting that a class produces a specific visual outcome (`expect(el).toHaveClass('largeRed')` → "therefore it's 24px red") tests the CSS module, not user-visible behaviour. Use ARIA / role queries for behaviour.
- **Implementation details** — e.g. that the component uses `useEffect`, that state is `useState`-backed. Test outputs, not internals.
- **Vendored primitive behaviour** — see the verification model below.

### Verification model — what's tested where

A component's docs/JSDoc often promise more behaviours than this package's test suite asserts directly. That's deliberate. Promises are verified by **whichever layer owns them**, and we don't duplicate work across layers. When a future agent reads "Dialog promises focus trap + Escape close + 6 other things" and sees only 4 tests, the conclusion shouldn't be "undertested" — it should be "the keyboard behaviours are Radix's and verified upstream."

The three layers:

1. **Our test suite** (`*.test.tsx` files). Covers what's actually our code:
   - Composition contracts — `className` lands on the right element, props are forwarded, sub-components render where expected
   - Props we added on top of the primitive — `label` on Spinner, `ariaLabelThumbs` on Slider, `inline` / `aria-current` on Link, `description` / `aria-describedby` toggle on Dialog/Drawer/Sidebar
   - JS-driven behaviour we wrote — Toaster bump dedup, Carousel scroll-snap counter, Spotlight combobox wiring
2. **Upstream test suite** (the dependency's own CI — Radix, Vaul, Sonner). Covers behaviours we inherit by wrapping:
   - Focus trap, Escape close, focus restoration (Radix Dialog, Vaul Drawer/Sidebar)
   - Roving focus + arrow-key navigation (Radix Tabs, Accordion, RadioGroup, Slider, Select)
   - Type-ahead + Escape close (Radix Select, Dropdown)
   - Single-selection invariant (Radix RadioGroup)
   - `aria-checked="mixed"` for indeterminate state (Radix Checkbox)
   - Swipe-to-dismiss gesture (Vaul)
   - Live-region announcement (Sonner Toaster)
3. **CSS source** (`packages/ui/src/styles/base.css`, component `.module.css` files). Static, verified by reading the file rather than by a runtime test:
   - `prefers-reduced-motion` collapse — global rule in `base.css` zeroes every animation/transition duration
   - `:focus-visible` ring tokens — global rule in `base.css`
   - `data-state='indeterminate'` switching the Checkbox indicator SVG — `Checkbox.module.css`

The reason this matters: when adding a test, ask **which layer owns the behaviour**. If the answer is "Radix" or "Vaul," don't add it here — you'd be re-running their CI as part of ours, paying maintenance cost forever for confidence we already have. If the answer is "CSS only," a runtime test in jsdom (which doesn't run keyframes or compute media-query styles reliably) is worse than no test — it's a test that lies. Document the promise and move on.

### Testing `className` composition (the one allowed `toHaveClass` use)

There is one legitimate use of `toHaveClass`: verifying that the **className prop contract** holds — i.e. that `className` lands on the right element and composes with our internal class instead of replacing it.

```tsx
// ✅ correct — testing the prop contract
it('forwards className alongside the internal class', () => {
  render(<RadioGroup className="extra" />);
  const group = screen.getByRole('radiogroup');
  expect(group).toHaveClass('root'); // internal class still present
  expect(group).toHaveClass('extra'); // consumer class composed in
});
```

This works because [vitest.config.ts](vitest.config.ts) sets `css.modules.classNameStrategy: 'non-scoped'`, so the unscoped name (`root`) is observable in tests. In production the same class is hashed. We're testing the **API**, not the styling.

The distinction:

- **Allowed**: `toHaveClass('root')` to verify "the internal class is on this element" and `toHaveClass('extra')` to verify "the consumer's class was forwarded."
- **Not allowed**: `toHaveClass('largeRed')` followed by an implicit assumption that "therefore the text is 24px red." That's testing CSS, which doesn't run in jsdom anyway.

### Mocks live in `test/setup.ts`

Browser APIs jsdom doesn't ship are mocked once globally. Each mock has an inline comment explaining which component needs it and why jsdom doesn't ship a real implementation.

| Mock | Why it's needed |
| ---- | --------------- |
| `IntersectionObserver` | jsdom doesn't implement it. Components that observe slides (Carousel) or visibility need it as a no-op constructor with spy-able methods. |
| `ResizeObserver` | jsdom doesn't implement it. Radix primitives measure element size on mount. |
| `matchMedia` | jsdom doesn't implement it. vaul (Drawer / Sidebar) reads it on mount to detect coarse-pointer devices. |
| Pointer-capture trio (`setPointerCapture` / `releasePointerCapture` / `hasPointerCapture`) | jsdom doesn't ship Pointer Events capture. Radix Select calls them during open/close transitions. |
| `scrollIntoView` | jsdom doesn't implement it. Radix Select calls it on the highlighted option when opening. |
| `Element.prototype.scrollTo` | jsdom defines it but as a no-op. We replace with `vi.fn()` so assertions can spy on smooth-scroll behaviour (Carousel). |
| `TouchEvent` | jsdom doesn't ship it. Minimal polyfill extending `UIEvent` so RTL's `fireEvent.touch*` doesn't fall back to generic Events. |

The `afterEach` hook in `test/setup.ts` re-stubs every global after `vi.unstubAllGlobals()` runs between tests. This is **load-bearing** — `unstubAllGlobals` clears the stubs we set, and without the re-stub the next test would crash on the first reference to e.g. `IntersectionObserver`. If you simplify the cleanup, expect unrelated tests to flake.

If a future component needs another browser-only API jsdom doesn't have (`MutationObserver` in some envs, `CSS.supports`, etc.), add the mock to `test/setup.ts` so every test file gets it — and add a row to the table above.

### Touch-event tests need explicit `timeStamp`

jsdom's Event constructor uses wall-clock time, so velocity-based handlers see useless deltas. The fix (used in `Carousel.test.tsx`):

```ts
function fireTouch(element, kind, x, y, timeStamp) {
  const init = kind === 'touchend' ? { changedTouches: [...] } : { touches: [...] };
  const factory = createEvent[kind === 'touchstart' ? 'touchStart' : ...];
  const event = factory(element, init);
  Object.defineProperty(event, 'timeStamp', { configurable: true, value: timeStamp });
  fireEvent(element, event);
}
```

The component reads `event.nativeEvent.timeStamp` (not React's synthetic `event.timeStamp`) so the post-construction override survives. If your component needs millisecond-accurate event timestamps in tests, follow the same pattern.

### Don't mock `performance.now` globally

It leaks into React 19's scheduler and creates flaky, unrelated failures. Override individual event `timeStamp`s instead (as above).

## Adding a new component

**Two valid paths — pick whichever fits the situation.** The generator is convenience tooling, not the canonical authority on shape; the canonical shape is documented in [Component structure](#component-structure) above. AI agents who already have the conventions in context can produce the right output directly and may find the generator's opinionated defaults (default `<div>` shell, generic test assertions, CSS module always created) less efficient than just writing the right files for the specific case.

### By hand — the canonical shape

For an agent or human who knows what they want:

1. Create the directory + files following [Component structure](#component-structure):
   ```
   src/components/<Name>/
     <Name>.tsx           — implementation, extends ComponentPropsWithRef<'tag'>
     <Name>.module.css    — omit if the component ships no styles of its own
     <Name>.test.tsx      — covers a11y + primary user interactions
     index.ts             — barrel re-export
   ```
2. Pick the right tag in `ComponentPropsWithRef<'tag'>` for what the component actually renders.
3. **Read `src/styles/variables.css`** before writing any CSS — default to tokens.
4. Create the matching `apps/docs/src/content/ui/components/<kebab>.mdx` doc page.
5. Add the component to `UI_NAV`'s **Components** items in [`apps/docs/src/components/Navigation/Navigation.tsx`](../../apps/docs/src/components/Navigation/Navigation.tsx) — keep the list alphabetized by display name.

### With the generator — when you want the boilerplate handled

```bash
pnpm generate:component        # from repo root
# or: pnpm --filter ui generate:component
```

Prompts for a PascalCase name and atomically creates:

```
packages/ui/src/components/<Name>/   <Name>.tsx  <Name>.module.css  <Name>.test.tsx  index.ts
apps/docs/src/content/ui/components/<kebab>.mdx
```

Also inserts the new entry into `UI_NAV`'s Components items **in alphabetical position** — the action parses the existing array, adds the new row, sorts by display name, and writes back. No manual reordering needed.

Post-generation, you still need to: replace the `<div>` shell with the real implementation, pick the right tag in `ComponentPropsWithRef<'tag'>`, fill in the MDX page, delete `<Name>.module.css` if the component ships no styles, and replace the generic test assertions with real ones.

The generator's templates live in `packages/ui/turbo/generators/templates/component/`. Keep them in sync with [Component structure](#component-structure) if you change the canonical shape.

**When the generator is worth running**:

- You're producing a generic primitive and the defaults match (e.g. you'd be writing a `<div>` shell with a CSS module anyway).
- You want the Navigation.tsx insertion handled atomically.
- You're a human tired of boilerplate.

**When skipping the generator is faster**:

- You're wrapping a Radix/vaul primitive — the default `<div>` shell isn't useful and the test template's "renders children + forwards className" assertions don't apply to passthroughs.
- The component has zero styles of its own — the generator creates a `.module.css` you'll just delete.
- You already know the exact non-default tag (`'button'`, `'input'`, `'svg'`) and the polymorphic shape.

Either way, the resulting code must match [Component structure](#component-structure) and pass lint + ts:check + tests.

## Adding a new shared hook

Same "two paths" framing — the canonical shape is in [File structure for hooks](#file-structure-for-hooks-utils-and-other-named-modules) above; the generator is convenience.

### By hand

```
src/hooks/<useFoo>/
  <useFoo>.ts           — implementation (carry 'use client' only if you call a client-only React API)
  <useFoo>.test.ts      — real assertions about the hook's contract
  index.ts              — barrel re-export
```

The hook is consumable as `import { useFoo } from 'ui/hooks/useFoo'` thanks to the `./hooks/*` wildcard in `package.json` `exports`.

### With the generator

```bash
pnpm generate:hook             # from repo root
```

Prompts for a `useFoo`-style camelCase name and creates the three files above with stub implementation + placeholder test.

**The generator's stub carries `'use client'` by default.** Drop it from the generated `.ts` if your hook doesn't call any client-only React API (`useState`, `useEffect`, `useRef`, `useLayoutEffect`, `useSyncExternalStore`, `useContext`). `useMemo` / `useCallback` alone don't require it.

**Use the generator only for hooks that go in the package-wide `src/hooks/` directory.** Component-internal hooks (used by one component only) follow the same folder + barrel shape but live at `src/components/<Component>/hooks/<useFoo>/` and aren't part of the public surface — drop those in by hand.

## What NOT to add here

- App-specific components (they belong in `apps/*/src/components/`).
- One-off utilities only used by a single app.
- Global CSS resets or body styles (those belong in `apps/*/src/styles/globals.css`).
