import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ljarcumlomzpanevbrki.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RIRb0139L7UWNFOkx_XPGg_hGIW3ELq';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    storageKey: 'pgx-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
