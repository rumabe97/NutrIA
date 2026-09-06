/**
 * Reads a required env var. Throws with a clear message at module-load time if it's
 * missing — much friendlier than the cryptic `ENOTFOUND` / `invalid URL` you'd get
 * from the Postgres client on first query.
 *
 * Imported by `client.ts` and `drizzle.config.ts`. Add new required env reads here
 * (and update `.env.example` at the repo root) when the schema gains new connection
 * strings or credentials.
 */
export function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}. Set it in your .env file.`);
  }

  return value;
}
