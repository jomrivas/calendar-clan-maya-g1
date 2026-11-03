import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getPublicSupabaseEnv } from "./env";

function createSupabaseClient() {
  const { url, key } = getPublicSupabaseEnv();
  const isBrowser = typeof window !== "undefined";
  return createClient<Database>(url, key, {
    auth: {
      storage: isBrowser ? window.localStorage : undefined,
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Uso: import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
