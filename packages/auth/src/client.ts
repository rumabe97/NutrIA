import { createBrowserClient } from '@supabase/ssr';

import { requiredPublic } from './env';

export function createClient() {
  return createBrowserClient(requiredPublic('NEXT_PUBLIC_SUPABASE_URL'), requiredPublic('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
}
