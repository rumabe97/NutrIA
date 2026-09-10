import { afterAll } from '@jest/globals';

import { closeDatabase } from 'database';

/**
 * Closes this file's database pool when its suite ends.
 *
 * Jest gives every test file its own module registry, so `database()` builds a
 * **fresh pool per suite** — fourteen suites times ten connections is more than
 * a default Postgres allows. Nothing says so when the limit is reached: the
 * driver's error is wrapped, and it surfaces as an unrelated 500 on whichever
 * suite happened to be running, which is exactly how it was found.
 *
 * It also lets the process exit. An open pool is an open handle, and a run that
 * finishes its tests and then sits there is a run that gets killed by a job
 * timeout and reported as "cancelled".
 */
afterAll(async () => {
  await closeDatabase();
});
