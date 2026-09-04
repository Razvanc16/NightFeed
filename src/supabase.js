import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rjeyiovwmkmltenmyhij.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZXlpb3Z3bWttbHRlbm15aGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Nzc4NTYsImV4cCI6MjA5NjE1Mzg1Nn0.3QgA2D94kqcjd_oUzOJDArVmczja3vc1ozJVYMo_be8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // true e necesar ca link-urile de recovery/confirmare (care conțin token în URL)
    // să fie recunoscute corect de Supabase și să declanșeze evenimentul PASSWORD_RECOVERY.
    detectSessionInUrl: true,
  },
});
