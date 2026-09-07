import { timestamp } from 'drizzle-orm/pg-core';

/**
 * `createdAt` / `updatedAt`, spread into any table that wants them.
 *
 * Lives apart from `_utils.ts` on purpose: `userOwned()` there needs the `user`
 * table, and `auth.schema.ts` needs these columns — putting both in one module
 * makes that a cycle, which drizzle-kit hits at config load ("Cannot access
 * 'timestamps' before initialization").
 */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
};
