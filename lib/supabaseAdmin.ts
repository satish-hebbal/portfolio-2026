import { createClient } from '@supabase/supabase-js'

// Server-only client. Uses the service-role key, which bypasses Row-Level
// Security, so it must NEVER be imported into client components. The key is
// read from SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix → never shipped
// to the browser).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
