import { Preview } from './src/components/Preview';
import { PropsTable } from './src/components/PropsTable';
import { Table } from './src/components/Table';
import { CodeBlock } from './src/components/CodeBlock';

import type { MDXComponents } from 'mdx/types';

// MDX `<p>` nesting landmine — read before adding anything that renders a `<p>`.
//
// MDX wraps multi-line JSX content in a `<p>` element. If you map a component that itself
// renders a `<p>` (e.g. our `Text`), you get `<p><p>…</p></p>` — invalid HTML and a React
// hydration error in production. The same trap applies to authors writing `.mdx` pages:
// anything that resolves to a `<p>` (raw `<p>`, `<Text>`, etc.) must have its children on a
// single line, or be wrapped in a JSX expression like `<Text>{<>multi-line</>}</Text>`. See
// apps/docs/AGENTS.md and packages/ui/AGENTS.md for the full rule.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { Preview, PropsTable, table: Table, pre: CodeBlock, ...components };
}
