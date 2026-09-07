/**
 * Barrel for the Drizzle client's `schema` option and for scripts that need the
 * whole set. Feature code should import the specific table it needs from
 * `database/schema/<file>` instead of pulling everything in.
 */
export * from './_columns';
export * from './_enums';
export * from './_utils';

export * from './ai.schema';
export * from './auth.schema';
export * from './food.schema';
export * from './plan.schema';
export * from './platform.schema';
export * from './profile.schema';
export * from './progress.schema';
export * from './recipe.schema';
export * from './safety.schema';
export * from './shopping.schema';
