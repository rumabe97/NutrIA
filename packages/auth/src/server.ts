import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { requiredPublic } from './env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(requiredPublic('NEXT_PUBLIC_SUPABASE_URL'), requiredPublic('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      }
    }
  });
}
