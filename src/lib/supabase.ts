import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// Use a dummy URL/key when env vars are not set so the module doesn't crash
// at import time. The isSupabaseConfigured() guard in kpi-persistence.ts
// prevents any real Supabase calls when the URL is not configured.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);
