// CSS Modules. Without this declaration `import styles from './X.module.css'`
// resolves to `any`, which silently disables every type-aware lint rule on the
// file — the same declaration lives in packages/ui/src/global.d.ts.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// CSS side-effect imports (local modules and shared package styles)
declare module '*.css';
declare module 'ui/styles/*';

type Keys<T> = keyof T;

type Values<T> = T[Keys<T>];

type Maybe<T> = T | null;

type OptionalSpread<T = undefined> = T extends undefined ? [] : [T];
