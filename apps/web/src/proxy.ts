import { updateSession } from 'auth/middleware';

import type { NextRequest } from 'next/server';

// Next.js v16 renamed `middleware.ts` → `proxy.ts` and the exported function
// from `middleware` → `proxy`. Refreshes Supabase auth cookies on every request
// — without this, sessions silently expire mid-navigation. See `apps/web/AGENTS.md`
// ("Proxy") and `packages/auth/AGENTS.md` for the full pattern.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
