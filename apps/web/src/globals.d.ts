// CSS side-effect imports (local modules and shared package styles)
declare module '*.css';
declare module 'ui/styles/*';

type Keys<T> = keyof T;

type Values<T> = T[Keys<T>];

type Maybe<T> = T | null;

type OptionalSpread<T = undefined> = T extends undefined ? [] : [T];
